// Opt-in integration and overhead experiment; never downloads or configures a server.
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import { main } from '../../../components/skills/development/pudu-task-telemetry/scripts/pudu-task.mjs';
import { TaskStore } from '../../../components/skills/development/pudu-task-telemetry/scripts/lib/task-store.mjs';
import { ollamaInventory, inspectModel, validateRequest, chat } from '../../../components/skills/development/pudu-task-telemetry/scripts/lib/ollama-adapter.mjs';
import { sampler } from '../../../components/skills/development/pudu-task-telemetry/scripts/lib/telemetry.mjs';
import { median } from '../../../components/skills/development/pudu-task-telemetry/scripts/lib/common.mjs';

assert.equal(process.env.PUDU_TEST_LOCAL_ONLY, '1', 'Confirm the test server is local-only.');
assert.ok(process.env.PUDU_TEST_MODEL, 'Choose an already installed test model.');
const baseUrl = process.env.PUDU_TEST_OLLAMA_URL ?? 'http://127.0.0.1:11434';
const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'pudu-live-check-'));
const outputFile = process.env.PUDU_TEST_REPORT;
try {
  await fs.writeFile(path.join(repo, 'config.json'), JSON.stringify({ ollama: { baseUrl, localOnlyConfirmed: true } }));
  await fs.writeFile(path.join(repo, 'task.txt'), 'Exact-answer smoke verification');
  await fs.writeFile(path.join(repo, 'request.json'), JSON.stringify({ schemaVersion: 1, messages: [{ role: 'user', content: 'Reply with exactly READY and nothing else.' }], options: { num_predict: 32 }, verification: { type: 'exact-text', expected: 'READY' } }));
  const invoke = args => main([...args, '--repo', repo, '--config', 'config.json', '--json']);
  const doctor = (await invoke(['doctor'])).result;
  const task = (await invoke(['start', '--task-file', 'task.txt'])).result;
  const run = await invoke(['run-local', '--task-id', task.taskId, '--request-file', 'request.json', '--model', process.env.PUDU_TEST_MODEL, '--output', 'result.txt']);
  assert.equal(run.exitCode, 0, 'Live inference or exact-answer verification failed.');
  const report = (await invoke(['finish', '--task-id', task.taskId, '--status', 'completed'])).result;
  assert.equal(report.verification.status, 'passed');
  const server = await ollamaInventory({ baseUrl });
  const model = await inspectModel(server, process.env.PUDU_TEST_MODEL);
  const request = validateRequest({ schemaVersion: 1, messages: [{ role: 'user', content: 'Write a detailed 400-word explanation of how a bicycle works. Explain the frame, wheels, pedals, chain, brakes, gears and steering in full paragraphs. Do not summarize early.' }], options: { temperature: 0, num_predict: 256, seed: 42 }, loadPolicy: 'warm' });
  await chat(server, model, request); // Separate, uncounted warm-up.
  const baseline = []; const instrumented = []; const pairs = [];
  const store = new TaskStore(repo);
  for (let pair = 0; pair < 10; pair++) {
    const values = {};
    for (const enabled of pair % 2 ? [true, false] : [false, true]) {
      const task = enabled ? await store.create('Overhead sample') : null;
      const dir = task ? await store.dir(task.taskId) : null;
      const attempt = { attemptId: randomUUID(), status: 'running', model, runtime: { name: 'ollama', version: server.version }, startedAt: new Date().toISOString(), endedAt: null, requestHash: request.requestHash, hardwareHash: 'experiment', metrics: {}, verification: { status: 'unverified', source: 'runner', checks: [] } };
      const start = performance.now();
      if (enabled) { task.attempts.push(attempt); await store.save(dir, task, 'attempt_started'); }
      const sample = enabled ? sampler() : null;
      const response = await chat(server, model, request);
      const sampled = sample?.stop();
      if (enabled) { attempt.status = 'completed'; attempt.endedAt = new Date().toISOString(); attempt.metrics = { ...response.metrics, ...sampled.metrics }; await store.save(dir, task, 'attempt_finished'); }
      const elapsed = performance.now() - start;
      (enabled ? instrumented : baseline).push(elapsed);
      values[enabled ? 'instrumentedMs' : 'baselineMs'] = elapsed;
      values[enabled ? 'instrumentedTokens' : 'baselineTokens'] = response.metrics.completion_tokens.value;
    }
    pairs.push(values);
  }
  const result = {
    timestamp: new Date().toISOString(), node: process.version,
    pudu: doctor.puduVersion, ollama: doctor.ollamaVersion, hardware: doctor.hardware,
    smoke: report,
    overhead: { pairs, baselineMedianMs: median(baseline), instrumentedMedianMs: median(instrumented), percent: (median(instrumented) / median(baseline) - 1) * 100, scope: 'same preflighted request; enabled adds sampling and durable attempt events; inventory/task creation excluded', limitations: 'Ten alternating pairs, warm model, one machine; not a statistical guarantee.' },
  };
  if (outputFile) await fs.writeFile(outputFile, JSON.stringify(result, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ smoke: report.verification, model: model.name, runtime: server.version, overhead: result.overhead }, null, 2) + '\n');
} finally { await fs.rm(repo, { recursive: true, force: true }); }
