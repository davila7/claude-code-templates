import { classify, extract, LocalTaskError, ollamaInfer, taskLimits } from '../src/tasks.js';

const ERROR_TEXT = 'Local task failed safely. No result was returned.';
const CONFIG_ERROR_TEXT = 'Local task unavailable: configure an explicit model and acknowledge verified Ollama cloud-off and host egress controls.';
const OLLAMA_ENDPOINT = 'http://127.0.0.1:11434';
const INFERENCE_TIMEOUT_MS = 30_000;

function parseArgs(args) {
  if (typeof args !== 'string' || args.length === 0 || new TextEncoder().encode(args).length > taskLimits.maxInputBytes + 2048) {
    throw new LocalTaskError('INVALID_TASK', 'Invalid task.');
  }
  const splitAt = args.indexOf(' ');
  if (splitAt < 1) throw new LocalTaskError('INVALID_TASK', 'Invalid task.');
  const operation = args.slice(0, splitAt);
  if (operation !== 'classify' && operation !== 'extract') throw new LocalTaskError('INVALID_TASK', 'Invalid task.');
  let raw;
  try {
    raw = JSON.parse(args.slice(splitAt + 1));
  } catch {
    throw new LocalTaskError('INVALID_TASK', 'Invalid task.');
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new LocalTaskError('INVALID_TASK', 'Invalid task.');
  const expected = operation === 'classify' ? ['text', 'labels'] : ['text', 'schema'];
  if (Object.keys(raw).some((key) => !expected.includes(key)) || expected.some((key) => !Object.hasOwn(raw, key))) {
    throw new LocalTaskError('INVALID_TASK', 'Invalid task.');
  }
  return { operation, task: Object.fromEntries(expected.map((key) => [key, raw[key]])) };
}

function configFrom(options) {
  if (!options || typeof options.model_id !== 'string' || !options.model_id.trim() || options.ollama_cloud_disabled !== true || options.host_egress_verified !== true) {
    throw new LocalTaskError('PRIVACY_ACK_REQUIRED', 'Configuration required.');
  }
  return {
    model: options.model_id,
    endpoint: OLLAMA_ENDPOINT,
    privacy: {
      ollamaCloudDisabled: options.ollama_cloud_disabled,
      hostEgressVerified: options.host_egress_verified,
    },
  };
}

export function register(on, options) {
  on('session.start', async ($, event, next) => {
    try {
      await $.command.register({
        name: 'local-task',
        description: 'Classify or extract bounded text with the configured local model',
        argumentHint: 'classify|extract <JSON task>',
      });
    } catch {
      // Do not include host exception text, which could contain user or plugin data.
    }
    return next(event);
  });

  on('command.run', { command: 'local-task' }, async ($, event, next) => {
    let config;
    try {
      config = configFrom(options);
    } catch {
      return { text: CONFIG_ERROR_TEXT };
    }
    try {
      const { operation, task } = parseArgs(event?.args);
      const infer = async (request) => {
        const controller = new AbortController();
        const parentSignal = next?.signal;
        const abort = () => controller.abort();
        let timer;
        try {
          timer = $.clock.after(INFERENCE_TIMEOUT_MS, abort);
          if (parentSignal?.aborted) abort();
          else parentSignal?.addEventListener('abort', abort, { once: true });
          return await ollamaInfer(request, { fetchImpl: (url, init) => $.http.fetch(url, init), signal: controller.signal });
        } finally {
          timer?.cancel();
          parentSignal?.removeEventListener('abort', abort);
        }
      };
      const result = operation === 'classify'
        ? await classify(task, { config, infer })
        : await extract(task, { config, infer });
      return { text: `Local ${operation} result (advisory; not independently verified):\n${JSON.stringify(result)}` };
    } catch {
      return { text: ERROR_TEXT };
    }
  });
}
