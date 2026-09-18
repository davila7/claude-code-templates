import { spawn } from 'node:child_process';
import { realpath, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { check, TaskError, hash } from './common.mjs';

export function processJson(command, args, { timeoutMs = 30000, signal } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'], signal });
    let output = '';
    let bytes = 0;
    let reason;
    const stop = error => { reason ??= error; child.kill('SIGTERM'); };
    const timer = setTimeout(() => stop(new TaskError('timeout', 'Pudu inventory timed out.', 5)), timeoutMs);
    let killTimer;
    child.on('spawn', () => {
      killTimer = setTimeout(() => child.kill('SIGKILL'), timeoutMs + 2000);
      killTimer.unref();
    });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > 8 * 1024 * 1024) stop(new TaskError('unsupported_contract', 'Pudu output exceeds the limit.', 4));
      else output += chunk.toString('utf8');
    });
    // Drain but do not retain stderr: it can contain paths or user data.
    child.stderr.resume();
    child.on('error', error => {
      reason ??= new TaskError(error.name === 'AbortError' ? 'cancelled' : 'dependency_missing', 'Pudu could not be executed.', error.name === 'AbortError' ? 130 : 3);
    });
    child.on('close', code => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      if (reason) return reject(reason);
      if (code !== 0) return reject(new TaskError('pudu_failed', 'Pudu inventory returned an error.', 4));
      try { resolve(JSON.parse(output)); }
      catch { reject(new TaskError('unsupported_contract', 'Pudu did not return valid JSON.', 4)); }
    });
  });
}

async function versionOf(command) {
  // Read package metadata, not `--version`: older Pudu CLIs open their dashboard for unknown flags.
  const candidates = command.includes(path.sep) ? [command] : (process.env.PATH ?? '').split(path.delimiter).map(dir => path.join(dir, command));
  for (const candidate of candidates) {
    try {
      await access(candidate);
      let dir = path.dirname(await realpath(candidate));
      for (let depth = 0; depth < 6; depth++) {
        try {
          const pkg = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'));
          if (pkg.name === 'pudu-ai') return pkg.version;
        } catch { /* Continue towards package root. */ }
        dir = path.dirname(dir);
      }
    } catch { /* Try next executable on PATH. */ }
  }
  return null;
}

export async function inventory(config = {}, signal) {
  const command = config.command ?? 'pudu-ai';
  const prefix = config.args ?? [];
  check(typeof command === 'string' && Array.isArray(prefix) && prefix.every(x => typeof x === 'string'), 'Invalid Pudu executable configuration.');
  const timeoutMs = config.timeoutMs ?? 30000;
  check(Number.isInteger(timeoutMs) && timeoutMs >= 10 && timeoutMs <= 1800000, 'Invalid Pudu timeoutMs.');
  const invoke = cmd => processJson(command, [...prefix, cmd, '--json', '--no-network', '--no-color'], { signal, timeoutMs });
  const [hardware, rows, version] = await Promise.all([invoke('hardware'), invoke('models'), versionOf(command)]);
  check(Number.isSafeInteger(hardware?.memory?.totalBytes) && hardware.memory.totalBytes > 0 && typeof hardware.os === 'string' && typeof hardware.arch === 'string', 'Unsupported Pudu hardware contract.', 'unsupported_contract', 4);
  check(Array.isArray(rows) && rows.every(row => typeof row?.local?.id === 'string' && typeof row.local.source === 'string'), 'Unsupported Pudu models contract.', 'unsupported_contract', 4);
  // No paths, machine identifiers, raw benchmark command lines, or raw catalog text leave this adapter.
  const profile = { os: hardware.os, arch: hardware.arch, cpu: hardware.cpu?.name ?? null, memoryBytes: hardware.memory.totalBytes, unified: hardware.memory.unified === true };
  return {
    version, hardware: profile, hardwareHash: hash(profile),
    models: rows.map(row => ({
      id: row.local.id, source: row.local.source, digest: row.local.digest ?? null,
      installed: row.local.source === 'ollama',
      catalogId: typeof row.catalog?.id === 'string' ? row.catalog.id : null,
      grade: ['S', 'A', 'B', 'C', 'D', 'F'].includes(row.compatibility?.grade) ? row.compatibility.grade : null,
      gradeOrigin: row.compatibility?.source ?? 'unavailable',
      benchmark: row.lastBenchmark?.origin === 'measured' ? {
        referenceHash: hash(row.lastBenchmark), runtime: 'llama-bench',
        generationTps: row.lastBenchmark.benchmark?.generationTokensPerSecond ?? null,
        scope: 'separate_benchmark',
      } : null,
    })),
  };
}
