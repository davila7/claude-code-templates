import { performance } from 'node:perf_hooks';
import { check, fail, TaskError, object, hash } from './common.mjs';
import { metric, runtimeMetrics } from './telemetry.mjs';

export function baseUrl(value = 'http://127.0.0.1:11434') {
  let url;
  try { url = new URL(value); } catch { fail('invalid_endpoint', 'Expected a loopback HTTP URL.'); }
  check(url.protocol === 'http:' && ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname) && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash, 'Only loopback HTTP origins are supported.', 'invalid_endpoint');
  if (url.hostname === 'localhost') url.hostname = '127.0.0.1';
  return url.origin;
}
export async function jsonRequest(base, route, body, signal) {
  const timeout = AbortSignal.timeout(10000);
  try {
    const response = await fetch(`${baseUrl(base)}${route}`, {
      method: body ? 'POST' : 'GET', redirect: 'error',
      headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    check(response.ok, 'Ollama metadata request failed.', 'runtime_error', 4);
    let text = '';
    let bytes = 0;
    const decoder = new TextDecoder();
    for await (const chunk of response.body) {
      bytes += chunk.length;
      check(bytes <= 8 * 1024 * 1024, 'Ollama metadata exceeds limit.', 'unsupported_contract', 4);
      text += decoder.decode(chunk, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof TaskError) throw error;
    if (signal?.aborted) fail('cancelled', 'Operation cancelled.', 130);
    if (timeout.aborted) fail('timeout', 'Ollama metadata timed out.', 5);
    fail('runtime_unavailable', 'Cannot read Ollama metadata; check server and API version.', 3);
  }
}
export async function ollamaInventory(config = {}, signal) {
  const base = baseUrl(config.baseUrl);
  const [tags, version] = await Promise.all([jsonRequest(base, '/api/tags', null, signal), jsonRequest(base, '/api/version', null, signal)]);
  check(object(tags) && Array.isArray(tags.models) && tags.models.every(m => object(m) && typeof m.name === 'string' && typeof m.digest === 'string') && object(version) && typeof version.version === 'string', 'Unsupported Ollama inventory contract.', 'unsupported_contract', 4);
  return { base, version: version.version, models: tags.models };
}
export async function inspectModel(server, modelName, signal) {
  const model = server.models.find(m => m.name === modelName || m.model === modelName);
  check(model, 'Model is not installed in Ollama.', 'model_missing', 3);
  const show = await jsonRequest(server.base, '/api/show', { model: model.name }, signal);
  check(object(show) && (show.capabilities === undefined || Array.isArray(show.capabilities)), 'Unsupported Ollama model contract.', 'unsupported_contract', 4);
  const remote = model.remote_host || model.remote_model || show.remote_host || show.remote_model || /(?:^|[:/-])cloud(?:$|[:/-])/i.test(model.name);
  check(!remote && model.size > 0 && /^[a-f0-9]{64}$/i.test(model.digest) && show.model_info?.['general.parameter_count'] > 0, 'Model is remote or its local provenance is unknown.', 'model_not_local', 4);
  check(Array.isArray(show.capabilities) && show.capabilities.includes('completion'), 'Model does not advertise text completion.', 'unsupported_model', 4);
  const architecture = show.model_info?.['general.architecture'];
  const context = show.model_info?.[`${architecture}.context_length`];
  check(Number.isInteger(context) && context > 0, 'Model context capacity is unknown.', 'unsupported_model', 4);
  return { name: model.name, digest: model.digest, sizeBytes: model.size, contextLength: context, quantization: model.details?.quantization_level ?? null };
}

export function validateRequest(request) {
  check(object(request) && request.schemaVersion === 1, 'Request schemaVersion must be 1.');
  check(Object.keys(request).every(k => ['schemaVersion', 'messages', 'options', 'limits', 'contextManifest', 'verification', 'taskKind', 'loadPolicy'].includes(k)), 'Unsupported request field.');
  check(Array.isArray(request.messages) && request.messages.length > 0 && request.messages.length <= 100, 'Provide 1 to 100 messages.');
  for (const message of request.messages) {
    check(object(message) && ['user', 'system', 'assistant'].includes(message.role) && typeof message.content === 'string' && Object.keys(message).every(k => ['role', 'content'].includes(k)), 'Messages support role and text content only.');
  }
  const options = { temperature: 0, num_ctx: 4096, num_predict: 512, ...request.options };
  check(Object.keys(options).every(k => ['temperature', 'num_ctx', 'num_predict', 'seed'].includes(k)), 'Unsupported generation option.');
  check(Number.isInteger(options.num_ctx) && options.num_ctx >= 512 && options.num_ctx <= 262144, 'num_ctx must be between 512 and 262144.');
  check(Number.isInteger(options.num_predict) && options.num_predict > 0 && options.num_predict <= options.num_ctx - 256, 'Reserve at least 256 tokens for input and template.');
  check(Number.isFinite(options.temperature) && options.temperature >= 0 && options.temperature <= 2, 'Invalid temperature.');
  check(options.seed === undefined || Number.isSafeInteger(options.seed), 'Invalid seed.');
  // A deliberately conservative byte bound, not a tokenizer measurement.
  const inputBound = request.messages.reduce((n, m) => n + Buffer.byteLength(m.content) + 64, 256);
  check(inputBound + options.num_predict <= options.num_ctx, 'Input byte bound plus output reserve exceeds context; reduce input or explicitly increase num_ctx.', 'context_budget');
  const limits = { timeoutMs: 120000, maxResponseBytes: 4194304, ...request.limits };
  check(Number.isInteger(limits.timeoutMs) && limits.timeoutMs >= 10 && limits.timeoutMs <= 1800000, 'Invalid timeoutMs.');
  check(Number.isInteger(limits.maxResponseBytes) && limits.maxResponseBytes >= 64 && limits.maxResponseBytes <= 16777216, 'Invalid response byte limit.');
  const manifest = request.contextManifest ?? [];
  check(Array.isArray(manifest), 'Invalid context manifest.');
  for (const item of manifest) {
    check(object(item) && typeof item.path === 'string' && !item.path.startsWith('/') && !item.path.includes('\\') && !item.path.split('/').includes('..') && /^[a-f0-9]{64}$/.test(item.sha256) && Number.isInteger(item.startLine) && item.startLine > 0 && Number.isInteger(item.endLine) && item.endLine >= item.startLine, 'Invalid context manifest entry.');
  }
  const verification = request.verification === undefined ? null : request.verification;
  check(verification === null || (object(verification) && verification.type === 'exact-text' && typeof verification.expected === 'string' && verification.expected.length > 0 && Object.keys(verification).every(k => ['type', 'expected'].includes(k))), 'Only exact-text runner verification is supported.');
  const loadPolicy = request.loadPolicy ?? 'uncontrolled';
  check(['warm', 'cold', 'uncontrolled'].includes(loadPolicy), 'Invalid loadPolicy.');
  return { messages: request.messages, options, limits, verification, manifest, loadPolicy,
    requestHash: hash({ messages: request.messages, options, manifest }), rubricHash: verification ? hash(verification) : null,
    inputBound, contextHash: hash(manifest) };
}

export async function chat(server, model, request, signal) {
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), request.limits.timeoutMs);
  const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  let firstChunk = null;
  let firstContent = null;
  let content = '';
  let final = null;
  let bytes = 0;
  const metrics = () => ({
    ...runtimeMetrics(final ?? {}),
    request_wall_ms: metric(performance.now() - started, 'ms', 'runner.monotonic'),
    first_chunk_ms: metric(firstChunk, 'ms', 'runner.monotonic'),
    first_content_ms: metric(firstContent, 'ms', 'runner.monotonic'),
  });
  try {
    const response = await fetch(`${baseUrl(server.base)}/api/chat`, {
      method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json' }, signal: combined,
      body: JSON.stringify({ model: model.name, messages: request.messages, options: request.options, stream: true, keep_alive: '5m' }),
    });
    check(response.ok, 'Ollama inference returned an HTTP error.', 'runtime_error', 4);
    const decoder = new TextDecoder();
    let buffer = '';
    const consume = line => {
      if (!line.trim()) return;
      check(!final, 'Unexpected data after terminal message.', 'unsupported_contract', 4);
      let value;
      try { value = JSON.parse(line); } catch { fail('unsupported_contract', 'Invalid NDJSON response.', 4); }
      check(object(value) && !value.error, 'Ollama stream returned an error.', 'runtime_error', 4);
      check(object(value.message), 'Invalid message object.', 'unsupported_contract', 4);
      check(!value.message.tool_calls?.length, 'Tool calls are not supported by this runner.', 'unsupported_contract', 4);
      const text = value.message.content;
      check(text === undefined || typeof text === 'string', 'Invalid message content.', 'unsupported_contract', 4);
      if (text) {
        firstContent ??= performance.now() - started;
        content += text;
      }
      if (value.done === true) final = value;
    };
    for await (const chunk of response.body) {
      firstChunk ??= performance.now() - started;
      bytes += chunk.length;
      check(bytes <= request.limits.maxResponseBytes, 'Ollama response exceeded byte limit.', 'response_limit', 4);
      buffer += decoder.decode(chunk, { stream: true });
      let newline;
      while ((newline = buffer.indexOf('\n')) !== -1) {
        consume(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
      }
    }
    buffer += decoder.decode();
    consume(buffer);
    check(final, 'Stream ended without a terminal message.', 'incomplete_stream', 4);
    return { content, metrics: metrics(), doneReason: ['stop', 'length'].includes(final.done_reason) ? final.done_reason : null };
  } catch (error) {
    const known = signal?.aborted ? new TaskError('cancelled', 'Inference cancelled.', 130)
      : controller.signal.aborted ? new TaskError('timeout', 'Inference timed out.', 5)
        : error instanceof TaskError ? error : new TaskError('runtime_error', 'Ollama inference failed.', 4);
    // Counts from an incomplete or rejected response are deliberately unavailable.
    final = null;
    known.metrics = metrics();
    throw known;
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
