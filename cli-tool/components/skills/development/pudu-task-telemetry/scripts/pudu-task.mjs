#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { realpathSync } from 'node:fs';
import { check, fail, hash, inputFile, object, publicError, TaskError, identifier } from './lib/common.mjs';
import { inventory } from './lib/pudu-adapter.mjs';
import { ollamaInventory, validateRequest, chat } from './lib/ollama-adapter.mjs';
import { sampler } from './lib/telemetry.mjs';
import { TaskStore } from './lib/task-store.mjs';
import { buildReport, verificationInput, markdown, compare } from './lib/report.mjs';
import { candidates, recommend } from './lib/model-selection.mjs';

const HELP = `Pudu task telemetry (Node >=20)
Usage: node pudu-task.mjs COMMAND [options]
Commands: doctor, recommend, start, run-local, finish, recover, report, compare
Common: --repo DIR --config FILE --json
start: --task-file FILE
recommend: --task-kind KIND --context-budget N [--evidence-file FILE]
run-local: --task-id UUID --request-file FILE --model NAME|auto
           [--task-kind KIND] [--output NEW_RELATIVE_FILE] [--retry-of ATTEMPT_UUID]
           [--evidence-file FILE]
finish: --task-id UUID --status completed|failed|cancelled [--verification-file FILE]
recover: --task-id UUID (only after the lock owner has exited)
report: --task-id UUID [--format json|markdown]
compare: --task-ids UUID,UUID
No packages/models are installed and no global settings are changed.
Configure ollama.localOnlyConfirmed only after checking the SERVER cloud-disable setting.
`;

async function gitIdentity(repo) {
  const run = async args => {
    try { return (await promisify(execFile)('git', args, { cwd: repo, timeout: 3000, maxBuffer: 4 * 1024 * 1024 })).stdout; }
    catch { return null; }
  };
  const [commit, diff, untracked] = await Promise.all([run(['rev-parse', 'HEAD']), run(['diff', 'HEAD', '--no-ext-diff', '--no-textconv']), run(['ls-files', '--others', '--exclude-standard'])]);
  return { commit: commit?.trim() ?? null, diffHash: diff === null ? null : hash(diff), untrackedContentCaptured: false, hasUntracked: untracked === null ? null : Boolean(untracked.trim()) };
}
async function configFile(file) {
  const config = file ? await inputFile(file) : {};
  check(object(config) && Object.keys(config).every(k => ['pudu', 'ollama'].includes(k)), 'Invalid configuration.');
  check(config.pudu === undefined || object(config.pudu), 'Invalid Pudu configuration.');
  check(config.ollama === undefined || object(config.ollama), 'Invalid Ollama configuration.');
  return config;
}
const fresh = task => check(task.status === 'running' && task.attempts.every(a => a.status !== 'running'), 'Task is closed or interrupted; recover interrupted tasks and start a new one.', 'task_state', 4);

export async function main(argv = process.argv.slice(2), { signal } = {}) {
  let values, positionals;
  try {
    ({ values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: Object.fromEntries([
      ...['repo', 'config', 'task-file', 'task-id', 'request-file', 'model', 'output', 'status', 'verification-file', 'format', 'task-ids', 'task-kind', 'context-budget', 'evidence-file', 'retry-of'].map(k => [k, { type: 'string' }]),
      ['json', { type: 'boolean' }], ['help', { type: 'boolean' }],
    ]) }));
  } catch { fail('invalid_input', 'Unknown or incomplete CLI option.'); }
  const command = positionals[0];
  if (values.help || !command) return { result: HELP, exitCode: 0 };
  check(positionals.length === 1, 'Unexpected positional arguments.');
  check(['doctor', 'recommend', 'start', 'run-local', 'finish', 'recover', 'report', 'compare'].includes(command), 'Unknown command.');
  const store = new TaskStore(values.repo ?? '.');
  const input = key => { check(values[key], `Missing --${key}.`); return path.resolve(store.repo, values[key]); };
  const config = await configFile(values.config ? input('config') : null);
  const id = values['task-id'];
  const evidence = async () => {
    if (!values['evidence-file']) return [];
    const ids = await inputFile(input('evidence-file'));
    check(Array.isArray(ids) && ids.length <= 500 && ids.every(x => typeof x === 'string'), 'Evidence must be an array of at most 500 local task UUIDs.');
    return Promise.all(ids.map(taskId => store.read(taskId)));
  };
  const runtime = async () => {
    const [pudu, server] = await Promise.all([inventory(config.pudu, signal), ollamaInventory(config.ollama, signal)]);
    return { pudu, server };
  };
  if (command === 'doctor') {
    const { pudu, server } = await runtime();
    return { result: { ok: true, node: process.version, puduVersion: pudu.version, ollamaVersion: server.version, hardware: pudu.hardware, localOnlyConfirmed: config.ollama?.localOnlyConfirmed === true,
      readyForInference: config.ollama?.localOnlyConfirmed === true && server.models.length > 0,
      privacyEvidence: 'operator_confirmation_not_server_attestation',
      models: {
        installed: pudu.models.filter(m => m.installed),
        recommended: pudu.models.filter(m => !m.installed),
      },
      limitations: ['System CPU/memory only; GPU, power, temperature, swap and model RSS unavailable.', 'Loopback alone does not establish no-cloud mode.'] } };
  }
  if (command === 'recommend') {
    const contextBudget = Number(values['context-budget'] ?? 4096);
    check(Number.isInteger(contextBudget) && contextBudget >= 512, 'Invalid context budget.');
    const taskKind = identifier(values['task-kind'] ?? 'general', 'task kind');
    const { pudu, server } = await runtime();
    const models = await candidates(pudu, server, contextBudget, signal);
    return { result: recommend(models, await evidence(), { hardwareHash: pudu.hardwareHash, runtimeVersion: server.version, taskKind, contextBudget }) };
  }
  if (command === 'start') return { result: await store.create(await inputFile(input('task-file'), false), await gitIdentity(store.repo)) };
  if (command === 'recover') return { result: buildReport(await store.recover(id)) };
  if (command === 'report') {
    const report = buildReport(await store.read(id));
    check(!values.format || ['json', 'markdown'].includes(values.format), 'Invalid report format.');
    return { result: values.format === 'markdown' ? markdown(report) : report };
  }
  if (command === 'compare') {
    const ids = (values['task-ids'] ?? '').split(',');
    check(ids.length >= 2 && ids.length <= 50 && new Set(ids).size === ids.length, 'Provide 2 to 50 distinct task IDs.');
    return { result: compare(await Promise.all(ids.map(taskId => store.read(taskId)))) };
  }
  if (command === 'finish') {
    const status = values.status;
    check(['completed', 'failed', 'cancelled'].includes(status), 'Invalid finish status.');
    const external = values['verification-file'] ? verificationInput(await inputFile(input('verification-file'))) : null;
    return store.lock(id, async dir => {
      const task = await store.read(id);
      const finishHash = hash({ status, external });
      if (task.status !== 'running') {
        check(task.finishHash === finishHash, 'Task already closed with a different result.', 'task_conflict', 4);
      } else {
        fresh(task);
        const verified = task.attempts.length && task.attempts.every(a => a.verification?.status !== 'unverified' && a.status === 'completed');
        task.verification = external ?? (verified ? { status: task.attempts.every(a => a.verification.status === 'passed') ? 'passed' : 'failed', source: 'runner', checks: task.attempts.map(a => ({ id: a.attemptId, passed: a.verification.status === 'passed' })) } : task.verification);
        task.status = status; task.endedAt = new Date().toISOString(); task.finishHash = finishHash;
        await store.save(dir, task, 'task_finished');
      }
      const report = buildReport(task); await store.report(id, report);
      return { result: report, exitCode: task.verification.status === 'failed' ? 6 : 0 };
    });
  }
  if (command === 'run-local') {
    check(config.ollama?.localOnlyConfirmed === true, 'Confirm the server cloud-disable configuration in ollama.localOnlyConfirmed before inference.', 'local_only_unconfirmed', 4);
    const request = validateRequest(await inputFile(input('request-file')));
    const taskKind = identifier(values['task-kind'] ?? 'general', 'task kind');
    check(values.model, 'Missing --model.');
    return store.lock(id, async dir => {
      const task = await store.read(id); fresh(task);
      check(task.attempts.length < 100, 'Maximum attempts per task reached.', 'task_limit', 4);
      if (values['retry-of']) check(task.attempts.some(a => a.attemptId === values['retry-of'] && a.requestHash === request.requestHash), 'Retry target must be a prior attempt with the same request.');
      const { pudu, server } = await runtime();
      const models = await candidates(pudu, server, request.options.num_ctx, signal);
      const picked = values.model === 'auto' ? recommend(models, await evidence(), { hardwareHash: pudu.hardwareHash, runtimeVersion: server.version, taskKind, contextBudget: request.options.num_ctx }).selected : values.model;
      check(picked, 'No verified comparable suite; select a local model explicitly.', 'needs_selection', 4);
      const model = models.find(m => m.name === picked);
      check(model && !model.excluded, 'Model is unavailable, remote, or exceeds context/memory limits.', 'model_ineligible', 4);
      const attempt = {
        attemptId: randomUUID(), retryOf: values['retry-of'] ?? null, taskKind,
        model: { name: model.name, digest: model.digest, quantization: model.quantization },
        runtime: { name: 'ollama', version: server.version }, puduVersion: pudu.version,
        hardwareHash: pudu.hardwareHash, benchmark: model.benchmark,
        options: request.options, requestHash: request.requestHash, contextHash: request.contextHash, rubricHash: request.rubricHash, loadPolicy: request.loadPolicy,
        privacyEvidence: 'operator_confirmed_server_local_only', startedAt: new Date().toISOString(), endedAt: null, status: 'running', metrics: {},
        verification: { status: 'unverified', source: 'runner', checks: [] },
      };
      task.attempts.push(attempt);
      await store.save(dir, task, 'attempt_started'); // Must succeed before inference.
      const sample = sampler();
      let error;
      let content;
      try {
        const response = await chat(server, model, request, signal);
        attempt.metrics = response.metrics; attempt.doneReason = response.doneReason;
        content = response.content;
        attempt.status = 'completed';
        if (request.verification) {
          const passed = content.trim() === request.verification.expected.trim();
          attempt.verification = { source: 'runner', status: passed ? 'passed' : 'failed', checks: [{ id: 'exact-text', passed }] };
        }
      } catch (e) {
        error = e instanceof TaskError ? e : new TaskError('runtime_error', 'Local attempt failed.', 4);
        attempt.metrics = error.metrics ?? attempt.metrics;
        attempt.status = error.code === 'cancelled' ? 'cancelled' : 'failed'; attempt.error = publicError(error);
      } finally {
        const samples = sample.stop();
        attempt.metrics = { ...attempt.metrics, ...samples.metrics };
        attempt.samples = samples.samples; attempt.sampleCoverageMs = samples.sampleCoverageMs;
        attempt.endedAt = new Date().toISOString();
      }
      let outputWritten = false;
      if (!error && values.output) {
        try {
          await store.writeOutput(values.output, content);
          outputWritten = true;
        } catch (e) {
          error = e instanceof TaskError ? e : new TaskError('output_error', 'Output must be a new file in an existing safe directory.', 7);
        }
      }
      try { await store.save(dir, task, 'attempt_finished'); }
      catch (e) { return { result: { ok: false, error: publicError(e), persisted: false, attempt }, exitCode: 7 }; }
      const failedVerification = attempt.verification.status === 'failed';
      return { result: { ok: !error && !failedVerification, taskId: id, attempt, outputWritten }, exitCode: error?.exitCode ?? (failedVerification ? 6 : 0) };
    });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const abort = new AbortController();
  process.once('SIGINT', () => abort.abort());
  process.once('SIGTERM', () => abort.abort());
  main(undefined, { signal: abort.signal }).then(({ result, exitCode = 0 }) => {
    process.stdout.write(typeof result === 'string' && !process.argv.includes('--json') ? result + '\n' : JSON.stringify(result, null, 2) + '\n');
    process.exitCode = exitCode;
  }).catch(error => {
    process.stdout.write(JSON.stringify({ ok: false, error: publicError(error) }) + '\n');
    process.exitCode = error.exitCode ?? 7;
  });
}
