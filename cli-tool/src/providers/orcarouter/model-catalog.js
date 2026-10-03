'use strict';

const {
  ERROR_CODES,
  LIMITS,
  VERIFIED_FALLBACK_MODELS,
  modelsUrl,
  catalogUrl,
  openAiBaseUrl,
} = require('./constants');
const { safeError, scrub } = require('./redact');

/**
 * OrcaRouter model catalog and capability filtering.
 *
 * The single source of truth is `GET /v1/models` on the configured inference
 * origin — for the public gateway, `GET https://api.orcarouter.ai/v1/models`.
 * The response carries per-model `supported_endpoint_types` and
 * `architecture.input_modalities`; capability decisions are made from that
 * metadata only, never from a model's name.
 *
 * When live discovery fails, a small verified cold-start catalog is used and
 * the result is flagged `degraded` so the caller can say so. A seed is never
 * merged into a successful live result.
 */

/**
 * Capability requirements per AI input surface. Each entry declares which
 * endpoint types can serve it and which non-text input modalities the surface
 * actually uploads.
 *
 * `catalogCapability` is the value sent as `?capability=` on `GET /v1/models`.
 * The gateway documents filters for chat, embedding and image, and those
 * responses are authoritative: the chat filter already excludes models whose
 * only text route is speech synthesis, which local endpoint matching alone
 * cannot tell apart from a real chat model. Video and rerank have no documented
 * filter value — `?capability=video` answers with an empty list even though the
 * catalog carries `openai-video` records — so those two read the unscoped
 * catalog and rely on the strict endpoint match below.
 */
const CAPABILITIES = {
  chat: {
    id: 'chat',
    endpointTypes: ['openai', 'openai-response', 'anthropic', 'gemini'],
    requireDeclaredEndpointType: false,
    inputModalities: [],
    catalogCapability: 'chat',
  },
  'chat+image': {
    id: 'chat+image',
    endpointTypes: ['openai', 'openai-response', 'anthropic', 'gemini'],
    requireDeclaredEndpointType: true,
    inputModalities: ['image'],
    catalogCapability: 'chat',
  },
  'chat+audio': {
    id: 'chat+audio',
    endpointTypes: ['openai', 'openai-response', 'anthropic', 'gemini'],
    requireDeclaredEndpointType: true,
    inputModalities: ['audio'],
    catalogCapability: 'chat',
  },
  'chat+video': {
    id: 'chat+video',
    endpointTypes: ['openai', 'openai-response', 'anthropic', 'gemini'],
    requireDeclaredEndpointType: true,
    inputModalities: ['video'],
    catalogCapability: 'chat',
  },
  embedding: {
    id: 'embedding',
    endpointTypes: ['embeddings'],
    requireDeclaredEndpointType: true,
    inputModalities: [],
    catalogCapability: 'embedding',
  },
  image: {
    id: 'image',
    endpointTypes: ['image-generation'],
    requireDeclaredEndpointType: true,
    inputModalities: [],
    catalogCapability: 'image',
  },
  video: {
    id: 'video',
    endpointTypes: ['openai-video'],
    requireDeclaredEndpointType: true,
    inputModalities: [],
    catalogCapability: null,
  },
  rerank: {
    id: 'rerank',
    endpointTypes: ['jina-rerank'],
    requireDeclaredEndpointType: true,
    inputModalities: [],
    catalogCapability: null,
  },
};

// Endpoint types that only serve a single non-text capability. A text chat
// surface must never offer them.
const NON_TEXT_ENDPOINT_TYPES = new Set([
  'image-generation',
  'openai-video',
  'jina-rerank',
  'embeddings',
]);

function capabilityFor(id, extraModalities = []) {
  if (id === 'chat' && extraModalities.length > 0) {
    const sorted = [...extraModalities].sort().join('+');
    const derived = CAPABILITIES[`chat+${sorted}`];
    if (derived) return derived;
    return {
      id: `chat+${sorted}`,
      endpointTypes: CAPABILITIES.chat.endpointTypes,
      requireDeclaredEndpointType: true,
      inputModalities: [...extraModalities],
    };
  }
  const capability = CAPABILITIES[id];
  if (!capability) {
    throw safeError(`Unknown OrcaRouter capability: ${id}`, { code: ERROR_CODES.catalogUnavailable });
  }
  return capability;
}

function endpointTypesOf(model) {
  const declared = model && model.supported_endpoint_types;
  return Array.isArray(declared) ? declared.filter((t) => typeof t === 'string') : [];
}

function inputModalitiesOf(model) {
  const architecture = model && model.architecture;
  const declared = architecture && architecture.input_modalities;
  return Array.isArray(declared) ? declared.filter((m) => typeof m === 'string') : [];
}

/**
 * Normalise one raw catalog record. Records that cannot be understood are
 * dropped rather than guessed at.
 *
 * @param {object} raw
 * @returns {object|null}
 */
function normaliseModel(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  if (!id) return null;

  const contextLength =
    Number.isFinite(raw.context_length) && raw.context_length > 0
      ? raw.context_length
      : Number.isFinite(raw.top_provider && raw.top_provider.context_length)
        ? raw.top_provider.context_length
        : null;

  return {
    // The vendor/model namespace is preserved verbatim — it is the identifier
    // the inference API expects and the key a user may have pinned.
    id,
    name: typeof raw.name === 'string' && raw.name ? raw.name : id,
    context_length: contextLength,
    max_completion_tokens:
      Number.isFinite(raw.max_completion_tokens) && raw.max_completion_tokens > 0
        ? raw.max_completion_tokens
        : null,
    input_modalities: inputModalitiesOf(raw),
    output_modalities: (raw.architecture && Array.isArray(raw.architecture.output_modalities)
      ? raw.architecture.output_modalities
      : []
    ).filter((m) => typeof m === 'string'),
    supported_endpoint_types: endpointTypesOf(raw),
    reasoning_efforts: normaliseReasoningEfforts(raw),
    description: typeof raw.description === 'string' ? raw.description : null,
    verified: false,
    source: 'live',
  };
}

function normaliseReasoningEfforts(raw) {
  const candidates = [];
  if (raw && Array.isArray(raw.reasoning_efforts)) candidates.push(...raw.reasoning_efforts);
  const reasoning = raw && raw.reasoning;
  if (reasoning && Array.isArray(reasoning.efforts)) candidates.push(...reasoning.efforts);
  if (reasoning && Array.isArray(reasoning.supported_efforts)) {
    candidates.push(...reasoning.supported_efforts);
  }
  return [...new Set(candidates.filter((e) => typeof e === 'string' && e))];
}

/**
 * Parse a `/v1/models` body defensively: bounded item count, accepted shapes
 * only, unsupported records skipped.
 *
 * @param {string} bodyText
 * @returns {object[]}
 */
function parseCatalog(bodyText) {
  let body;
  try {
    body = JSON.parse(bodyText);
  } catch (_) {
    throw safeError('OrcaRouter model catalog was not valid JSON.', {
      code: ERROR_CODES.catalogUnavailable,
    });
  }
  const list = Array.isArray(body) ? body : body && Array.isArray(body.data) ? body.data : null;
  if (!list) {
    throw safeError('OrcaRouter model catalog did not contain a `data` array.', {
      code: ERROR_CODES.catalogUnavailable,
    });
  }
  const models = [];
  for (const raw of list.slice(0, LIMITS.catalogMaxModels)) {
    const model = normaliseModel(raw);
    if (model) models.push(model);
  }
  return models;
}

/**
 * Decide whether a model can serve a capability.
 *
 * Chat always requires an OpenAI/Anthropic/Gemini-capable route and excludes
 * models whose only endpoint types are non-text. Non-text modalities must be
 * *declared* by `architecture.input_modalities`; an undeclared capability fails
 * closed, so an unknown model never appears in a multimodal dropdown.
 *
 * @param {object} model
 * @param {string} capabilityId
 * @param {string[]} [extraModalities]
 * @returns {boolean}
 */
function supportsCapability(model, capabilityId, extraModalities = []) {
  const capability = capabilityFor(capabilityId, extraModalities);
  const endpoints = model.supported_endpoint_types || [];

  const routeMatches = (types) => {
    if (types.some((type) => capability.endpointTypes.includes(type))) return true;
    // `openai-response` is an OpenAI-compatible chat route even when `openai`
    // itself is not listed alongside it.
    return capability.endpointTypes.includes('openai') && types.includes('openai-response');
  };

  if (capability.requireDeclaredEndpointType) {
    const endpointOk =
      endpoints.length === 0 ? capability.id !== 'chat' : routeMatches(endpoints);
    if (!endpointOk) return false;
  } else {
    if (endpoints.length === 0) {
      // No endpoint metadata at all: nothing may be assumed about modalities,
      // so only a plain text chat surface is offered.
      return capability.inputModalities.length === 0 && capability.id === 'chat';
    }
    const nonTextOnly = endpoints.every((type) => NON_TEXT_ENDPOINT_TYPES.has(type));
    if (nonTextOnly || !routeMatches(endpoints)) return false;
  }

  // Modality requirements are checked last and always: a model that declares no
  // input modalities fails closed for a multimodal surface.
  if (capability.inputModalities.length > 0) {
    const declared = model.input_modalities || [];
    return capability.inputModalities.every((modality) => declared.includes(modality));
  }
  return true;
}

/**
 * Build the option list handed to a model selector: filtered for one
 * capability, labels and metadata preserved, ids untouched.
 *
 * @param {object[]} models
 * @param {string} capabilityId
 * @param {string[]} [extraModalities]
 */
function listModelsFor(models, capabilityId, extraModalities = []) {
  if (!Array.isArray(models)) return [];
  return models
    .filter((model) => supportsCapability(model, capabilityId, extraModalities))
    .map((model) => ({
      id: model.id,
      label: model.name || model.id,
      context_length: model.context_length,
      input_modalities: model.input_modalities || [],
      supported_endpoint_types: model.supported_endpoint_types || [],
      reasoning_efforts: model.reasoning_efforts || [],
      verified: !!model.verified,
      source: model.source || 'live',
    }));
}

/**
 * Option list used by a capability that the public gateway does not currently
 * advertise (no embedding model reachable, for example). Returning an empty
 * list is the honest answer; it is never padded with hand-written examples.
 */
function emptyCapabilityResult(capabilityId) {
  return { capability: capabilityId, options: [], count: 0 };
}

/**
 * True when a previously chosen model may still be used for a capability.
 * Used before restoring a persisted selection.
 */
function isSelectionStillValid(models, modelId, capabilityId, extraModalities = []) {
  if (!modelId) return false;
  const model = models.find((candidate) => candidate.id === modelId);
  if (!model) return false;
  return supportsCapability(model, capabilityId, extraModalities);
}

/**
 * URL for one capability's catalog. An explicit `url` always wins; otherwise
 * the documented `?capability=` filter is applied, falling back to the unscoped
 * catalog for capabilities the gateway does not filter on.
 *
 * @param {string} capabilityId
 * @param {{env?: object, url?: string}} [options]
 */
function catalogUrlFor(capabilityId, options = {}) {
  if (options.url) return options.url;
  const env = options.env || process.env;
  let capability;
  try {
    capability = capabilityFor(capabilityId).catalogCapability;
  } catch (_) {
    capability = null;
  }
  return capability ? catalogUrl(env, capability) : modelsUrl(env);
}

async function fetchCatalog(options = {}) {
  const doFetch = options.fetchImpl || globalThis.fetch;
  const url = options.url || catalogUrlFor(options.capability || 'chat', options);
  const credential = options.credential || null;
  const timeoutMs = options.timeoutMs || LIMITS.catalogTimeoutMs;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const known = credential && credential.key ? [credential.key] : [];

  let response;
  try {
    const headers = { Accept: 'application/json' };
    // Prefer the user's own key so the catalog reflects the models their
    // workspace can actually call. The endpoint also answers anonymously; that
    // broader list is used only when no credential is available.
    if (credential && credential.key) headers.Authorization = `Bearer ${credential.key}`;
    response = await doFetch(url, { headers, signal: controller.signal });
  } catch (error) {
    clearTimeout(timer);
    throw safeError(`Could not reach the OrcaRouter model catalog at ${url}: ${error.message}`, {
      code: ERROR_CODES.catalogUnavailable,
      known,
    });
  }
  clearTimeout(timer);

  const bodyText = await response.text();
  if (!response.ok) {
    throw safeError(
      `OrcaRouter model catalog returned HTTP ${response.status}` +
        (response.status === 401 ? ' (the stored credential was rejected)' : '') +
        '.',
      {
        code: response.status === 401 ? ERROR_CODES.needsReauth : ERROR_CODES.catalogUnavailable,
        status: response.status,
        details: { body: scrub(bodyText.slice(0, 500), known) },
        known,
      }
    );
  }
  if (bodyText.length > LIMITS.catalogMaxBytes) {
    throw safeError('OrcaRouter model catalog response exceeded the accepted size limit.', {
      code: ERROR_CODES.catalogUnavailable,
    });
  }
  return parseCatalog(bodyText);
}

/**
 * Resolve a catalog with a bounded fallback.
 *
 * @param {{credential?: object, fetchImpl?: Function, env?: object,
 *          url?: string, timeoutMs?: number, fallbackModels?: object[]}} [options]
 * @returns {Promise<{models: object[], degraded: boolean, reason: string|null,
 *                    source: string, catalogUrl: string}>}
 */
async function resolveCatalog(options = {}) {
  const catalogUrl_ = catalogUrlFor(options.capability || 'chat', options);
  try {
    const models = await fetchCatalog({ ...options, url: catalogUrl_ });
    // An empty list is a truthful answer for a capability-scoped catalog the
    // gateway genuinely does not advertise (it answers HTTP 200 with
    // `{"data":[],"success":true}`). That is *not* an outage, so it must not be
    // replaced by the chat-shaped verified seed and reported as degraded — the
    // honest answer is "this capability has no models", which the caller renders
    // as an empty selector rather than as a fallback.
    return {
      models,
      degraded: false,
      reason: null,
      empty: models.length === 0,
      source: 'live',
      catalogUrl: catalogUrl_,
    };
  } catch (error) {
    const fallback = options.fallbackModels || VERIFIED_FALLBACK_MODELS;
    return {
      models: fallback.map((model) => ({ ...model })),
      degraded: true,
      reason: error.code || ERROR_CODES.catalogUnavailable,
      message: error.message,
      empty: false,
      source: 'verified-fallback',
      catalogUrl: catalogUrl_,
    };
  }
}

/**
 * Selector payload for one capability, including the degraded/refresh state the
 * caller must surface. Never returns hand-written example models.
 */
async function resolveCapabilityOptions(capabilityId, options = {}) {
  const catalog = await resolveCatalog({ ...options, capability: capabilityId });
  const extra = options.extraModalities || [];
  const options_ = listModelsFor(catalog.models, capabilityId, extra);
  return {
    capability: capabilityId,
    models: catalog.models,
    options: options_,
    count: options_.length,
    degraded: catalog.degraded,
    reason: catalog.reason || null,
    source: catalog.source,
    catalogUrl: catalog.catalogUrl,
    empty: options_.length === 0,
  };
}

module.exports = {
  CAPABILITIES,
  NON_TEXT_ENDPOINT_TYPES,
  capabilityFor,
  normaliseModel,
  normaliseReasoningEfforts,
  parseCatalog,
  supportsCapability,
  listModelsFor,
  emptyCapabilityResult,
  isSelectionStillValid,
  catalogUrlFor,
  fetchCatalog,
  resolveCatalog,
  resolveCapabilityOptions,
  openAiBaseUrl,
};
