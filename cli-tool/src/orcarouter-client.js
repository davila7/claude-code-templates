'use strict';

/**
 * Thin, dependency-free client for the OrcaRouter inference API.
 *
 * Every AI input surface in this repository that originates its own request
 * goes through here, so the base URL, the Bearer transport, and the 401
 * handling exist once. Credentials come from the shared credential store: this
 * module never asks which adapter produced them.
 */

const { openAiBaseUrl, ERROR_CODES, LIMITS } = require('./providers/orcarouter/constants');
const { safeError, scrub, redactDeep } = require('./providers/orcarouter/redact');

const DEFAULT_TIMEOUT_MS = 120000;

/**
 * Resolve the credential to use. Accepts either a credential record or a store.
 */
function credentialFrom(options) {
  if (options.credential) return options.credential;
  if (options.store) return options.store.get();
  const { CredentialStore } = require('./providers/orcarouter/credential-store');
  return new CredentialStore({ env: options.env }).get();
}

function endpointUrl(path, options) {
  const base = options.baseUrl || openAiBaseUrl(options.env);
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base.replace(/\/+$/, '')}${suffix}`;
}

/**
 * Decide whether an HTTP status requires reauthentication.
 *
 * A 401 from the relay means the credential itself was rejected. A 403 is
 * ambiguous: it is used both for a revoked credential and for a key whose
 * *model scope* does not include the requested model. Treating the latter as
 * revocation would mark a perfectly good credential broken, so the error body
 * is inspected before deciding.
 *
 * @param {number} status
 * @param {string} [bodyText]
 */
function isTerminalAuthStatus(status, bodyText) {
  if (status === 401) return true;
  if (status !== 403) return false;
  if (bodyText && /model_access_denied|block_key_scope/.test(bodyText)) return false;
  return true;
}

function isModelScopeDenial(status, bodyText) {
  return status === 403 && !!bodyText && /model_access_denied|block_key_scope/.test(bodyText);
}

/**
 * Record a terminal failure against the exact credential generation that made
 * the rejected request. A failure from an older generation is ignored, so a
 * late error can never mark a freshly re-authorized credential as broken.
 *
 * @param {object} store
 * @param {object} credential
 * @param {number} status
 */
function recordTerminalFailure(store, credential, status, bodyText) {
  if (!store || !credential || !isTerminalAuthStatus(status, bodyText)) return null;
  if (credential.source === 'env') return null; // nothing durable to mark
  return store.markNeedsReauth({ status, generation: credential.generation });
}

/**
 * POST a chat completion to OrcaRouter.
 *
 * @param {{messages: object[], model: string, stream?: boolean,
 *          temperature?: number, max_tokens?: number, extra?: object,
 *          credential?: object, store?: object, env?: object,
 *          fetchImpl?: Function, baseUrl?: string, timeoutMs?: number}} input
 */
async function chatCompletion(input) {
  const credential = credentialFrom(input);
  if (!credential || !credential.key) {
    throw safeError('No OrcaRouter credential available for this request.', {
      code: ERROR_CODES.needsReauth,
    });
  }
  if (credential.needsReauth) {
    throw safeError(
      'The stored OrcaRouter credential was rejected by the gateway and must be replaced ' +
        'before further requests.',
      { code: ERROR_CODES.needsReauth }
    );
  }

  const doFetch = input.fetchImpl || globalThis.fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs || DEFAULT_TIMEOUT_MS);
  const known = [credential.key];

  const body = {
    model: input.model,
    messages: input.messages,
    ...(input.extra || {}),
  };
  if (input.stream) body.stream = true;
  if (Number.isFinite(input.temperature)) body.temperature = input.temperature;
  if (Number.isFinite(input.max_tokens)) body.max_tokens = input.max_tokens;

  let response;
  try {
    response = await doFetch(endpointUrl('/chat/completions', input), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: input.stream ? 'text/event-stream' : 'application/json',
        Authorization: `Bearer ${credential.key}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    throw safeError(`OrcaRouter request failed: ${error.message}`, {
      code: ERROR_CODES.network,
      known,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    if (isModelScopeDenial(response.status, text)) {
      throw safeError(
        `This OrcaRouter key is not scoped for model "${input.model}". Pick another model from ` +
          'the selector, or widen this key\'s model access at ' +
          'https://www.orcarouter.ai/console/token. The credential itself is fine.',
        {
          code: ERROR_CODES.modelNotAllowed,
          status: response.status,
          known,
        }
      );
    }
    if (isTerminalAuthStatus(response.status, text)) {
      recordTerminalFailure(input.store, credential, response.status, text);
      throw safeError(
        'OrcaRouter rejected the stored credential (HTTP ' +
          response.status +
          '). Revoked keys must be replaced: re-run the connect flow or paste a new key. ' +
          `Manage authorized apps at https://www.orcarouter.ai/console/authorized-apps.`,
        {
          code: ERROR_CODES.needsReauth,
          status: response.status,
          details: { body: scrub(text.slice(0, 300), known) },
          known,
        }
      );
    }
    if (response.status === 429) {
      throw safeError('OrcaRouter rate-limited the request (HTTP 429). Retry after a short delay.', {
        code: ERROR_CODES.rateLimited,
        status: response.status,
        known,
      });
    }
    throw safeError(`OrcaRouter returned HTTP ${response.status}.`, {
      code: ERROR_CODES.network,
      status: response.status,
      details: redactDeep({ body: scrub(text.slice(0, 300), known) }, known),
      known,
    });
  }

  if (input.stream) return { stream: response.body, response, credentialGeneration: credential.generation };
  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (_) {
    throw safeError('OrcaRouter returned a response that is not valid JSON.', {
      code: ERROR_CODES.network,
      known,
    });
  }
  return { payload: parsed, response, credentialGeneration: credential.generation };
}

/** GET /models through the same transport, for callers that need raw records. */
async function listModelRecords(options = {}) {
  const credential = credentialFrom(options);
  const doFetch = options.fetchImpl || globalThis.fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || LIMITS.catalogTimeoutMs);
  const headers = { Accept: 'application/json' };
  if (credential && credential.key) headers.Authorization = `Bearer ${credential.key}`;
  try {
    const response = await doFetch(endpointUrl('/models', options), {
      headers,
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      throw safeError(`OrcaRouter model catalog returned HTTP ${response.status}.`, {
        code: isTerminalAuthStatus(response.status, text)
          ? ERROR_CODES.needsReauth
          : ERROR_CODES.catalogUnavailable,
        status: response.status,
        known: credential ? [credential.key] : [],
      });
    }
    return JSON.parse(text);
  } catch (error) {
    if (error.code) throw error;
    throw safeError(`Could not reach the OrcaRouter model catalog: ${error.message}`, {
      code: ERROR_CODES.catalogUnavailable,
      known: credential ? [credential.key] : [],
    });
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  isTerminalAuthStatus,
  isModelScopeDenial,
  recordTerminalFailure,
  endpointUrl,
  chatCompletion,
  listModelRecords,
};
