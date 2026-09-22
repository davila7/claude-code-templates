'use strict';

/**
 * Static configuration for the OrcaRouter provider.
 *
 * Authentication and inference live on two different public origins. They are
 * never derived from one another: `ORCA_AUTH_BASE_URL` / `ORCA_API_BASE_URL`
 * are explicit overrides, `ORCA_BASE_URL` is the shared self-hosted fallback,
 * and an explicit override always wins over the shared value.
 */

const PUBLIC_AUTH_BASE = 'https://www.orcarouter.ai';
const PUBLIC_API_BASE = 'https://api.orcarouter.ai';

const AUTHORIZE_PATH = '/auth';
const EXCHANGE_PATH = '/api/v1/auth/keys';
const DEVICE_CODE_PATH = '/api/v1/auth/device/code';
const DEVICE_TOKEN_PATH = '/api/v1/auth/device/token';
const OPENID_CONFIGURATION_PATH = '/.well-known/openid-configuration';

// Inference paths, relative to the inference origin.
const OPENAI_API_SUFFIX = '/v1';
const ANTHROPIC_WIRE_SUFFIX = '';

const PROVIDER_ID = 'orcarouter';
const PROVIDER_NAME = 'OrcaRouter';
const API_KEY_PROVIDER_ID = 'orcarouter';
const API_KEY_PROVIDER_LABEL = 'OrcaRouter - API';
const PKCE_PROVIDER_ID = 'orcarouter-oauth';
const PKCE_PROVIDER_LABEL = 'OrcaRouter - Auth';

const KEY_PREFIX = 'sk-orca-';
const CONSOLE_KEYS_URL = 'https://www.orcarouter.ai/console/token';
const CONSOLE_AUTHORIZED_APPS_URL = 'https://www.orcarouter.ai/console/authorized-apps';
const LOGO_URL = 'https://www.orcarouter.ai/orca-logo-classic.png';
const TERMS_URL = 'https://www.orcarouter.ai/terms.html';
const APP_NAME = 'Claude Code Templates';

const ENV_KEYS = {
  authBase: 'ORCA_AUTH_BASE_URL',
  apiBase: 'ORCA_API_BASE_URL',
  sharedBase: 'ORCA_BASE_URL',
  apiKey: 'ORCAROUTER_API_KEY',
};

/**
 * Error codes shared by the credential adapters and the catalog client so
 * callers can branch on a stable value instead of parsing messages.
 */
const ERROR_CODES = {
  denied: 'access_denied',
  stateMismatch: 'state_mismatch',
  timeout: 'authorization_timeout',
  cancelled: 'authorization_cancelled',
  codeRejected: 'code_rejected',
  scopeDowngraded: 'scope_downgraded',
  rateLimited: 'rate_limited',
  network: 'network_error',
  needsReauth: 'needs_reauth',
  invalidKey: 'invalid_api_key',
  modelNotAllowed: 'model_not_allowed',
  catalogUnavailable: 'catalog_unavailable',
  unsupportedFlow: 'unsupported_flow',
};

const LIMITS = {
  catalogTimeoutMs: 10000,
  catalogMaxBytes: 4 * 1024 * 1024,
  catalogMaxModels: 2000,
  connectTimeoutMs: 5 * 60 * 1000,
  exchangeTimeoutMs: 30000,
};

function trimTrailingSlash(value) {
  return typeof value === 'string' ? value.replace(/\/+$/, '') : value;
}

function isLoopbackHost(hostname) {
  return (
    hostname === '127.0.0.1' ||
    hostname === 'localhost' ||
    hostname === '::1' ||
    hostname === '[::1]'
  );
}

/**
 * Resolve an origin from configuration, refusing to silently weaken transport
 * security: remote origins must be HTTPS, plain HTTP is only accepted for
 * loopback development.
 *
 * @param {string|undefined} value
 * @param {string} fallback
 * @returns {string}
 */
function resolveOrigin(value, fallback) {
  const candidate = trimTrailingSlash(value && String(value).trim());
  if (!candidate) return fallback;

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch (_) {
    throw new Error(`Invalid OrcaRouter base URL: ${candidate}`);
  }

  if (parsed.protocol === 'https:') return trimTrailingSlash(parsed.origin);
  if (parsed.protocol === 'http:' && isLoopbackHost(parsed.hostname)) {
    return trimTrailingSlash(parsed.origin);
  }
  throw new Error(
    `Refusing to use a non-HTTPS OrcaRouter origin (${parsed.protocol}//${parsed.hostname}). ` +
      'Plain HTTP is only allowed for loopback development.'
  );
}

/**
 * Origin used for the authorize screen and the code exchange.
 * @param {NodeJS.ProcessEnv} [env]
 */
function authBaseUrl(env = process.env) {
  const explicit = env[ENV_KEYS.authBase];
  if (explicit && String(explicit).trim()) return resolveOrigin(explicit, PUBLIC_AUTH_BASE);
  return resolveOrigin(env[ENV_KEYS.sharedBase], PUBLIC_AUTH_BASE);
}

/**
 * Inference origin. The OpenAI-compatible base is this origin plus `/v1`.
 * @param {NodeJS.ProcessEnv} [env]
 */
function apiBaseUrl(env = process.env) {
  const explicit = env[ENV_KEYS.apiBase];
  if (explicit && String(explicit).trim()) return resolveOrigin(explicit, PUBLIC_API_BASE);
  return resolveOrigin(env[ENV_KEYS.sharedBase], PUBLIC_API_BASE);
}

/** OpenAI-compatible inference base, e.g. https://api.orcarouter.ai/v1 */
function openAiBaseUrl(env = process.env) {
  return `${apiBaseUrl(env)}${OPENAI_API_SUFFIX}`;
}

/** Anthropic wire base, e.g. https://api.orcarouter.ai (Claude Code appends /v1). */
function anthropicBaseUrl(env = process.env) {
  return `${apiBaseUrl(env)}${ANTHROPIC_WIRE_SUFFIX}`;
}

function authorizeUrl(env = process.env) {
  return `${authBaseUrl(env)}${AUTHORIZE_PATH}`;
}

function exchangeUrl(env = process.env) {
  return `${authBaseUrl(env)}${EXCHANGE_PATH}`;
}

function deviceCodeUrl(env = process.env) {
  return `${authBaseUrl(env)}${DEVICE_CODE_PATH}`;
}

function deviceTokenUrl(env = process.env) {
  return `${authBaseUrl(env)}${DEVICE_TOKEN_PATH}`;
}

function modelsUrl(env = process.env) {
  return `${openAiBaseUrl(env)}/models`;
}

/**
 * Capability-scoped catalog URL. The gateway's `GET /v1/models` accepts a
 * `capability` filter, and scoping the request is what keeps a selector's
 * contents equal to the catalog that capability actually advertises — a text
 * chat surface must never receive a list that still contains image, video or
 * embedding records it then has to be trusted to filter out.
 *
 * Non-text modalities are deliberately *not* sent as a query parameter: the
 * gateway does not narrow on them, so a multimodal surface scopes to `chat`
 * here and filters on `architecture.input_modalities` locally.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @param {string} [capability]
 */
function catalogUrl(env = process.env, capability = 'chat') {
  const url = new URL(modelsUrl(env));
  url.searchParams.set('capability', capability);
  return url.toString();
}

/**
 * Small, verified cold-start catalog. Used only when live discovery fails, and
 * only for the capabilities each entry is known to serve. Sources: the live
 * `GET https://api.orcarouter.ai/v1/models` catalog plus the OrcaRouter
 * integration guide's seed list. Metadata (context, input modalities,
 * reasoning effort ladder) is preserved from that catalog.
 */
const VERIFIED_FALLBACK_MODELS = [
  {
    id: 'orcarouter/auto',
    name: 'OrcaRouter Auto',
    context_length: 200000,
    input_modalities: ['text'],
    supported_endpoint_types: ['openai', 'openai-response', 'anthropic', 'gemini'],
    reasoning_efforts: [],
    verified: true,
    source: 'orcarouter-catalog',
  },
  {
    id: 'openai/gpt-5.5',
    name: 'OpenAI: GPT-5.5',
    context_length: 400000,
    input_modalities: ['text', 'image', 'file'],
    supported_endpoint_types: ['openai', 'openai-response'],
    reasoning_efforts: ['low', 'medium', 'high', 'xhigh'],
    verified: true,
    source: 'orcarouter-catalog',
  },
  {
    id: 'anthropic/claude-opus-4.8',
    name: 'Anthropic: Claude Opus 4.8',
    context_length: 1000000,
    input_modalities: ['text', 'image', 'file'],
    supported_endpoint_types: ['openai', 'anthropic', 'openai-response'],
    reasoning_efforts: [],
    verified: true,
    source: 'orcarouter-catalog',
  },
  {
    id: 'google/gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    context_length: 1048576,
    input_modalities: ['text', 'image', 'video', 'file', 'audio'],
    supported_endpoint_types: ['openai', 'gemini'],
    reasoning_efforts: [],
    verified: true,
    source: 'orcarouter-catalog',
  },
  {
    id: 'deepseek/deepseek-v4-pro',
    name: 'DeepSeek: DeepSeek V4 Pro',
    context_length: 1048576,
    input_modalities: ['text'],
    supported_endpoint_types: ['openai', 'openai-response'],
    reasoning_efforts: [],
    verified: true,
    source: 'orcarouter-catalog',
  },
];

module.exports = {
  PUBLIC_AUTH_BASE,
  PUBLIC_API_BASE,
  AUTHORIZE_PATH,
  EXCHANGE_PATH,
  DEVICE_CODE_PATH,
  DEVICE_TOKEN_PATH,
  OPENID_CONFIGURATION_PATH,
  OPENAI_API_SUFFIX,
  ANTHROPIC_WIRE_SUFFIX,
  PROVIDER_ID,
  PROVIDER_NAME,
  API_KEY_PROVIDER_ID,
  API_KEY_PROVIDER_LABEL,
  PKCE_PROVIDER_ID,
  PKCE_PROVIDER_LABEL,
  KEY_PREFIX,
  CONSOLE_KEYS_URL,
  CONSOLE_AUTHORIZED_APPS_URL,
  LOGO_URL,
  TERMS_URL,
  APP_NAME,
  ENV_KEYS,
  ERROR_CODES,
  LIMITS,
  VERIFIED_FALLBACK_MODELS,
  resolveOrigin,
  isLoopbackHost,
  authBaseUrl,
  apiBaseUrl,
  openAiBaseUrl,
  anthropicBaseUrl,
  authorizeUrl,
  exchangeUrl,
  deviceCodeUrl,
  deviceTokenUrl,
  modelsUrl,
  catalogUrl,
};
