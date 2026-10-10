import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from '../hooks/register.js';

function setup(options = {}) {
  const hooks = [];
  const calls = [];
  const timers = [];
  const api = {
    clock: { after: (milliseconds, callback) => { const timer = { milliseconds, callback, cancelled: false, cancel() { this.cancelled = true; } }; timers.push(timer); return timer; } },
    command: { register: async (command) => calls.push({ kind: 'register', command }) },
    http: { fetch: async (url, init) => {
      calls.push({ kind: 'fetch', url, init });
      const data = JSON.parse(init.body);
      const output = data.messages[0].content.startsWith('Extract')
        ? { value: { name: 'Ada' }, evidence: 'Ada' }
        : { label: 'bug', evidence: 'returns 503' };
      return { status: 200, ok: true, text: JSON.stringify({ message: { content: JSON.stringify(output) } }) };
    } },
  };
  register((event, matcherOrHandler, maybeHandler) => {
    const matcher = typeof matcherOrHandler === 'function' ? undefined : matcherOrHandler;
    const handler = typeof matcherOrHandler === 'function' ? matcherOrHandler : maybeHandler;
    hooks.push({ event, matcher, handler });
  }, options);
  const sessionStart = hooks.find((hook) => hook.event === 'session.start');
  const commandRun = hooks.find((hook) => hook.event === 'command.run');
  return { hooks, calls, api, timers, sessionStart, commandRun };
}

const safeOptions = {
  model_id: 'qwen3:8b',
  ollama_cloud_disabled: true,
  host_egress_verified: true,
};

test('native mod registers local-task at session.start and matches command.run by name', async () => {
  const ctx = setup(safeOptions);
  assert.ok(ctx.sessionStart);
  assert.deepEqual(ctx.commandRun.matcher, { command: 'local-task' });
  let passed = false;
  await ctx.sessionStart.handler(ctx.api, {}, (event) => { passed = true; return event; });
  assert.equal(passed, true);
  assert.deepEqual(ctx.calls[0], { kind: 'register', command: { name: 'local-task', description: 'Classify or extract bounded text with the configured local model', argumentHint: 'classify|extract <JSON task>' } });
});

test('command returns a validated classification result in Claude context and calls only loopback', async () => {
  const ctx = setup(safeOptions);
  const result = await ctx.commandRun.handler(ctx.api, { args: 'classify {"text":"The service returns 503.","labels":["bug","question"]}' });
  assert.match(result.text, /"label":"bug"/);
  const request = ctx.calls.find((call) => call.kind === 'fetch');
  assert.equal(request.url, 'http://127.0.0.1:11434/api/chat');
  const sent = JSON.parse(request.init.body);
  assert.equal(sent.model, safeOptions.model_id);
  assert.equal(sent.stream, false);
  assert.equal(ctx.timers[0].milliseconds, 30_000);
  assert.equal(ctx.timers[0].cancelled, true);
  assert.equal(sent.messages[1].content, '{"text":"The service returns 503.","labels":["bug","question"]}');
});

test('command performs schema-limited extraction and ignores no undeclared output keys', async () => {
  const ctx = setup(safeOptions);
  ctx.api.http.fetch = async () => ({ status: 200, ok: true, text: JSON.stringify({ message: { content: JSON.stringify({ value: { name: 'Ada', extra: 'drop' }, evidence: 'Ada' }) } }) });
  const result = await ctx.commandRun.handler(ctx.api, { args: 'extract {"text":"Ada arrived","schema":{"name":"string"}}' });
  assert.match(result.text, /"value":{"name":"Ada"}/);
  assert.doesNotMatch(result.text, /\"extra\"/);
});

test('missing model or manual privacy acknowledgments refuses before any fetch', async () => {
  for (const options of [{ ...safeOptions, model_id: '' }, { ...safeOptions, ollama_cloud_disabled: false }, { ...safeOptions, host_egress_verified: false }]) {
    const ctx = setup(options);
    const result = await ctx.commandRun.handler(ctx.api, { args: 'classify {"text":"private","labels":["a"]}' });
    assert.deepEqual(result, { text: 'Local task unavailable: configure an explicit model and acknowledge verified Ollama cloud-off and host egress controls.' });
    assert.equal(ctx.calls.some((call) => call.kind === 'fetch'), false);
    assert.doesNotMatch(result.text, /private/);
  }
});

test('invalid task and model failures return fixed text without echoing task input', async () => {
  const ctx = setup(safeOptions);
  const invalid = await ctx.commandRun.handler(ctx.api, { args: 'classify {"text":"secret value","labels":["a"],"extra":"secret"}' });
  assert.equal(invalid.text, 'Local task failed safely. No result was returned.');
  assert.doesNotMatch(invalid.text, /secret/);
  ctx.api.http.fetch = async () => ({ status: 503, ok: false, text: 'secret upstream details' });
  const failed = await ctx.commandRun.handler(ctx.api, { args: 'classify {"text":"private","labels":["a"]}' });
  assert.equal(failed.text, 'Local task failed safely. No result was returned.');
  assert.doesNotMatch(failed.text, /private|secret|503/);
});


test('inference has a 30-second native timer that aborts the HTTP request and is cancelled on completion', async () => {
  const ctx = setup(safeOptions);
  let requestSignal;
  ctx.api.http.fetch = async (_url, init) => {
    requestSignal = init.signal;
    return new Promise((resolve, reject) => {
      if (init.signal.aborted) reject(new Error('aborted'));
      else init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    });
  };
  const command = ctx.commandRun.handler(ctx.api, { args: 'classify {"text":"The service returns 503.","labels":["bug"]}' }, { signal: new AbortController().signal });
  for (let turn = 0; turn < 10 && !requestSignal; turn += 1) await Promise.resolve();
  const timer = ctx.timers[0];
  const timeoutWasScheduled = timer?.milliseconds === 30_000;
  if (timeoutWasScheduled) timer.callback();
  else requestSignal?.dispatchEvent(new Event('abort'));
  const result = await command;
  assert.equal(timeoutWasScheduled, true, 'request should start the native 30-second timer');
  assert.equal(requestSignal?.aborted, true, 'timeout should abort the actual fetch signal');
  assert.equal(timer.cancelled, true, 'timer should be cancelled after request completion');
  assert.equal(result.text, 'Local task failed safely. No result was returned.');
});

test('next.signal cancellation aborts the request signal and returns a generic failure', async () => {
  const ctx = setup(safeOptions);
  const upstream = new AbortController();
  let requestSignal;
  ctx.api.http.fetch = async (_url, init) => {
    requestSignal = init.signal;
    return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  };
  const command = ctx.commandRun.handler(ctx.api, { args: 'classify {"text":"private","labels":["a"]}' }, { signal: upstream.signal });
  for (let turn = 0; turn < 10 && !requestSignal; turn += 1) await Promise.resolve();
  upstream.abort();
  const result = await command;
  assert.equal(requestSignal?.aborted, true);
  assert.equal(result.text, 'Local task failed safely. No result was returned.');
  assert.doesNotMatch(result.text, /private/);
  assert.equal(ctx.timers[0]?.cancelled, true);
});
