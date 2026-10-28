'use strict';

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const {
  PROVIDER_ID,
  PROVIDER_NAME,
  API_KEY_PROVIDER_ID,
  API_KEY_PROVIDER_LABEL,
  PKCE_PROVIDER_ID,
  PKCE_PROVIDER_LABEL,
  ENV_KEYS,
  ERROR_CODES,
  LIMITS,
  anthropicBaseUrl,
  openAiBaseUrl,
  authBaseUrl,
  LOGO_URL,
  TERMS_URL,
  CONSOLE_KEYS_URL,
} = require('./constants');
const { CredentialStore } = require('./credential-store');
const { describeCredentialSources } = require('./credential-sources');
const { resolveCatalog, listModelsFor } = require('./model-catalog');
const { safeError, redactSecret } = require('./redact');

/**
 * The OrcaRouter provider entry.
 *
 * One provider, two credential sources, one inference route. This module is the
 * only place that knows how OrcaRouter is addressed, so every AI input surface
 * in the CLI resolves the same base URL, the same transport, and the same model
 * catalog.
 */

const SETTINGS_RELATIVE_PATH = path.join('components', 'settings', 'partnerships');

function claudeSettingsPath(targetDir) {
  return path.join(targetDir || process.cwd(), '.claude', 'settings.json');
}

function readJsonSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null;
  }
}

/**
 * Redacted status of the stored credential. Never includes the key itself.
 * @param {{store?: object, env?: object, fetchImpl?: Function}} [options]
 */
function getStatus(options = {}) {
  const store = options.store || new CredentialStore({ env: options.env });
  const sources = describeCredentialSources();
  let description;
  try {
    description = store.describe();
  } catch (error) {
    description = { configured: false, error: error.message };
  }
  return {
    provider: PROVIDER_ID,
    name: PROVIDER_NAME,
    credential: description,
    authBaseUrl: authBaseUrl(options.env),
    apiBaseUrl: openAiBaseUrl(options.env),
    anthropicBaseUrl: anthropicBaseUrl(options.env),
    sources: sources.map((source) => ({
      id: source.id,
      label: source.label,
      available: true,
      kind: source.isApiKey ? 'api_key' : 'pkce',
    })),
    consoleKeysUrl: CONSOLE_KEYS_URL,
  };
}

/**
 * Capability-filtered model options from the live catalog, with the verified
 * fallback used only when discovery fails.
 *
 * @param {{capability?: string, extraModalities?: string[]}} [capability]
 * @param {{store?: object, env?: object, fetchImpl?: Function,
 *          url?: string, timeoutMs?: number}} [options]
 */
async function getModelOptions(capability = {}, options = {}) {
  const store = options.store || new CredentialStore({ env: options.env });
  let credential = null;
  try {
    credential = store.get();
  } catch (_) {
    credential = null;
  }
  const capabilityId = capability.capability || 'chat';
  const catalog = await resolveCatalog({
    credential,
    capability: capabilityId,
    env: options.env,
    fetchImpl: options.fetchImpl,
    url: options.url,
    timeoutMs: options.timeoutMs || LIMITS.catalogTimeoutMs,
    fallbackModels: options.fallbackModels,
  });
  const options_ = listModelsFor(catalog.models, capabilityId, capability.extraModalities || []);
  return {
    provider: PROVIDER_ID,
    capability: capabilityId,
    options: options_,
    count: options_.length,
    degraded: catalog.degraded,
    reason: catalog.reason || null,
    message: catalog.message || null,
    source: catalog.source,
    catalogUrl: catalog.catalogUrl,
  };
}

/**
 * Write the OrcaRouter provider selection into a project's
 * `.claude/settings.json`, preserving unrelated settings.
 *
 * @param {{targetDir?: string, settings?: object}} [options]
 */
function writeProjectSettings(options = {}) {
  const settingsPath = claudeSettingsPath(options.targetDir);
  const existing = readJsonSafe(settingsPath) || {};
  const env = { ...(existing.env || {}), ...(options.settings && options.settings.env) };
  const settings = {
    ...existing,
    ...(options.settings || {}),
    env,
  };
  fs.ensureDirSync(path.dirname(settingsPath));
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
  return settingsPath;
}

/**
 * Environment block that points Claude Code at OrcaRouter using the stored
 * credential. The key is never printed; callers pass this straight to a spawn
 * options object.
 *
 * @param {{store?: object, env?: object, model?: string,
 *          anthropicCompatible?: boolean}} [options]
 */
function getClaudeCodeEnvironment(options = {}) {
  const store = options.store || new CredentialStore({ env: options.env });
  const credential = store.get();
  if (!credential) {
    throw safeError(
      `No OrcaRouter credential found. Store an API key (${CONSOLE_KEYS_URL}) or run the ` +
        'connect flow first.',
      { code: ERROR_CODES.needsReauth }
    );
  }
  if (credential.needsReauth) {
    throw safeError(
      'The stored OrcaRouter credential was rejected by the gateway. Re-run the connect flow ' +
        'or paste a new key; the old credential is not used until it is replaced.',
      { code: ERROR_CODES.needsReauth }
    );
  }
  const env = {
    ANTHROPIC_BASE_URL: anthropicBaseUrl(options.env),
    ANTHROPIC_AUTH_TOKEN: credential.key,
  };
  if (options.model) env.ANTHROPIC_MODEL = options.model;
  return env;
}

/**
 * Environment block for OpenAI-compatible call sites (the sandbox launchers and
 * the skill scripts that speak the OpenAI wire format).
 */
function getOpenAiEnvironment(options = {}) {
  const store = options.store || new CredentialStore({ env: options.env });
  const credential = store.get();
  if (!credential) {
    throw safeError('No OrcaRouter credential found.', { code: ERROR_CODES.needsReauth });
  }
  return {
    OPENAI_BASE_URL: openAiBaseUrl(options.env),
    OPENAI_API_KEY: credential.key,
  };
}

/**
 * The provider entry as data, for any registry, catalog, or GUI that lists
 * providers. Labels are stable and match the credential sources.
 */
function describeProvider() {
  return {
    id: PROVIDER_ID,
    name: PROVIDER_NAME,
    description:
      'OrcaRouter is an OpenAI-compatible AI gateway that routes many providers behind one endpoint.',
    type: 'openai-compatible',
    authMethods: describeCredentialSources().map((source) => ({
      id: source.id,
      label: source.label,
      kind: source.isApiKey ? 'api_key' : 'pkce',
      flow: source.isPkce ? 'oauth2-pkce-s256' : null,
    })),
    defaultModel: 'orcarouter/auto',
    apiBaseUrl: openAiBaseUrl(),
    anthropicBaseUrl: anthropicBaseUrl(),
    authBaseUrl: authBaseUrl(),
    modelsEndpoint: `${openAiBaseUrl()}/models`,
    envKeys: ENV_KEYS,
    keyPrefix: 'sk-orca-',
    logo: LOGO_URL,
    termsUrl: TERMS_URL,
    consoleKeysUrl: CONSOLE_KEYS_URL,
  };
}

module.exports = {
  PROVIDER_ID,
  PROVIDER_NAME,
  API_KEY_PROVIDER_ID,
  API_KEY_PROVIDER_LABEL,
  PKCE_PROVIDER_ID,
  PKCE_PROVIDER_LABEL,
  SETTINGS_RELATIVE_PATH,
  claudeSettingsPath,
  getStatus,
  getModelOptions,
  writeProjectSettings,
  getClaudeCodeEnvironment,
  getOpenAiEnvironment,
  describeProvider,
  redactSecret,
  safeError,
};
