'use strict';

const {
  ERROR_CODES,
  APP_NAME,
  deviceCodeUrl,
  deviceTokenUrl,
  authorizeUrl,
  exchangeUrl,
  authBaseUrl,
  API_KEY_PROVIDER_ID,
  API_KEY_PROVIDER_LABEL,
  PKCE_PROVIDER_ID,
  PKCE_PROVIDER_LABEL,
  CONSOLE_KEYS_URL,
  CONSOLE_AUTHORIZED_APPS_URL,
} = require('./constants');
const { safeError, scrub, redactSecret } = require('./redact');
const { AUTH_METHODS, validateApiKeyShape } = require('./credential-store');
const {
  connectWithLoopback,
  connectWithOutOfBandCode,
  exchangeCodeForKey,
} = require('./pkce');
const { startLoopbackListener } = require('./loopback-listener');

/**
 * The credential seam.
 *
 * A credential source knows how to obtain an OrcaRouter credential and hand it
 * to the store. There are exactly two: a pasted API key and the OAuth 2.0 +
 * PKCE connect flow. Everything downstream consumes the stored record, so the
 * provider adapter and the model catalog never branch on which source ran.
 *
 * Adding a third source means implementing `acquire()` and registering it here
 * — nothing else in the tree changes.
 *
 * @typedef {object} CredentialSource
 * @property {string} id
 * @property {string} label
 * @property {string} method      value stored in the credential record
 * @property {boolean} interactive
 * @property {(ctx: object) => Promise<object>} acquire
 */

const FLOWS = {
  loopback: 'loopback',
  oob: 'oob',
  device: 'device',
};

/**
 * API-key source: the user pastes an `sk-orca-…` key. Works headless, in CI,
 * and for anyone who already manages a key in the console.
 *
 * @type {CredentialSource}
 */
const apiKeySource = {
  id: API_KEY_PROVIDER_ID,
  label: API_KEY_PROVIDER_LABEL,
  method: AUTH_METHODS.apiKey,
  interactive: false,

  /**
   * @param {{store: object, apiKey?: string, prompts?: object,
   *          account?: string}} ctx
   */
  async acquire(ctx) {
    const store = ctx.store;
    let key = ctx.apiKey;
    if (!key && ctx.prompts && ctx.prompts.askForKey) {
      key = await ctx.prompts.askForKey({
        message: `Paste your OrcaRouter API key (${CONSOLE_KEYS_URL})`,
      });
    }
    const shape = validateApiKeyShape(key);
    if (!shape.ok) {
      throw safeError(
        `That does not look like an OrcaRouter API key (${shape.reason}). ` +
          `Keys start with sk-orca- and are created at ${CONSOLE_KEYS_URL}.`,
        { code: ERROR_CODES.invalidKey, known: [key] }
      );
    }
    // Format only: validity is unknown until a real request, and no paid
    // inference request is sent just to make a settings form show "valid".
    const record = store.save({
      key: String(key).trim(),
      method: AUTH_METHODS.apiKey,
      scope: 'api',
      account: ctx.account || 'api-key',
    });
    return { credential: record, method: AUTH_METHODS.apiKey, source: this.id };
  },
};

async function requestDeviceCode(input) {
  const doFetch = input.fetchImpl || globalThis.fetch;
  const response = await doFetch(deviceCodeUrl(input.env || process.env), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ app_name: input.appName || APP_NAME, scope: input.scope || 'api' }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw safeError(`OrcaRouter device authorization could not be started (HTTP ${response.status}).`, {
      code: ERROR_CODES.network,
      status: response.status,
      details: { body: scrub(text.slice(0, 300)) },
    });
  }
  try {
    return JSON.parse(text);
  } catch (_) {
    throw safeError('OrcaRouter device authorization response was not valid JSON.', {
      code: ERROR_CODES.network,
    });
  }
}

/**
 * Flow C: device grant (RFC 8628). Extra capability for headless boxes; it is
 * never used in place of PKCE, which is why it is not the default.
 */
async function connectWithDeviceGrant(input) {
  const start = await requestDeviceCode(input);
  // Print exactly what the server handed us; never rebuild the complete URI.
  input.prompts.showDeviceInstructions({
    verificationUriComplete: start.verification_uri_complete || null,
    verificationUri: start.verification_uri || null,
    userCode: start.user_code || null,
    expiresIn: start.expires_in || 600,
  });

  const doFetch = input.fetchImpl || globalThis.fetch;
  const intervalMs = Math.max(1, Number(start.interval) || 5) * 1000;
  const deadline = Date.now() + (Number(start.expires_in) || 600) * 1000;
  const sleep = input.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));

  while (Date.now() < deadline) {
    await sleep(intervalMs);
    const response = await doFetch(deviceTokenUrl(input.env || process.env), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        device_code: start.device_code,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });
    const text = await response.text();
    let body = {};
    try {
      body = JSON.parse(text);
    } catch (_) {
      throw safeError('OrcaRouter device token response was not valid JSON.', {
        code: ERROR_CODES.network,
      });
    }

    // Branch on `error` and nothing else.
    if (!body.error) {
      if (!body.key) {
        throw safeError('OrcaRouter device authorization succeeded without returning a key.', {
          code: ERROR_CODES.codeRejected,
        });
      }
      return {
        key: body.key,
        userId: body.user_id ? String(body.user_id) : null,
        scope: body.scope || 'api',
        method: 'pkce',
        flow: FLOWS.device,
      };
    }
    if (body.error === 'authorization_pending') continue;
    if (body.error === 'slow_down') continue;
    throw safeError(`OrcaRouter device authorization failed: ${body.error}.`, {
      code: body.error === 'access_denied' ? ERROR_CODES.denied : ERROR_CODES.codeRejected,
      details: { description: body.error_description || null },
    });
  }
  throw safeError('OrcaRouter device authorization timed out.', { code: ERROR_CODES.timeout });
}

/**
 * PKCE source: sign in with an OrcaRouter account and receive a durable key.
 *
 * @type {CredentialSource}
 */
const pkceSource = {
  id: PKCE_PROVIDER_ID,
  label: PKCE_PROVIDER_LABEL,
  method: AUTH_METHODS.pkce,
  interactive: true,

  /**
   * @param {{store: object, flow?: string, prompts: object,
   *          fetchImpl?: Function, env?: object, openBrowser?: Function,
   *          serverFactory?: Function, timeoutMs?: number,
   *          scope?: string, appName?: string}} ctx
   */
  async acquire(ctx) {
    const env = ctx.env || process.env;
    const endpoint = authorizeUrl(env);
    const flow = ctx.flow || FLOWS.loopback;
    const store = ctx.store;

    let result;
    if (flow === FLOWS.device) {
      result = await connectWithDeviceGrant({
        fetchImpl: ctx.fetchImpl,
        env,
        prompts: ctx.prompts,
        appName: ctx.appName,
        scope: ctx.scope,
      });
    } else if (flow === FLOWS.oob) {
      result = await connectWithOutOfBandCode({
        authEndpoint: endpoint,
        prompts: ctx.prompts,
        openBrowser: ctx.openBrowser,
        fetchImpl: ctx.fetchImpl,
        appName: ctx.appName,
        scope: ctx.scope,
        loginHint: ctx.loginHint,
      });
      result.flow = FLOWS.oob;
    } else if (flow === FLOWS.loopback) {
      result = await connectWithLoopback({
        authEndpoint: endpoint,
        serverFactory:
          ctx.serverFactory || ((options) => startLoopbackListener(options)),
        openBrowser: ctx.openBrowser || (async () => {}),
        fetchImpl: ctx.fetchImpl,
        appName: ctx.appName,
        scope: ctx.scope,
        timeoutMs: ctx.timeoutMs,
        onAuthorizeUrl: ctx.prompts && ctx.prompts.showUrl,
      });
      result.flow = FLOWS.loopback;
    } else {
      throw safeError(`Unsupported OrcaRouter connect flow: ${flow}`, {
        code: ERROR_CODES.unsupportedFlow,
      });
    }

    if (result.downgraded) {
      // The response reports what was granted, not what was asked for.
      if (ctx.prompts && ctx.prompts.warnScope) {
        ctx.prompts.warnScope({
          requested: ctx.scope || 'api',
          granted: result.scope,
          missing: result.missingScopes || [],
        });
      }
    }

    const record = store.save({
      key: result.key,
      method: AUTH_METHODS.pkce,
      scope: result.scope || 'api',
      userId: result.userId || null,
      account: result.userId ? `user:${result.userId}` : 'pkce',
    });
    return { credential: record, method: AUTH_METHODS.pkce, source: this.id, flow: result.flow };
  },
};

const ALL_SOURCES = [apiKeySource, pkceSource];

/**
 * Look up a credential source by its registered provider id.
 * @param {string} id
 * @returns {CredentialSource}
 */
function credentialSource(id) {
  const source = ALL_SOURCES.find((candidate) => candidate.id === id);
  if (!source) {
    throw safeError(`Unknown OrcaRouter credential source: ${id}`, {
      code: ERROR_CODES.invalidKey,
    });
  }
  return source;
}

/** Descriptions for help output; labels come from one place. */
function describeCredentialSources() {
  return ALL_SOURCES.map((source) => ({
    id: source.id,
    label: source.label,
    method: source.method,
    interactive: source.interactive,
    isApiKey: source.method === AUTH_METHODS.apiKey,
    isPkce: source.method === AUTH_METHODS.pkce,
  }));
}

module.exports = {
  FLOWS,
  apiKeySource,
  pkceSource,
  ALL_SOURCES,
  credentialSource,
  describeCredentialSources,
  connectWithDeviceGrant,
  // re-exported so callers can see the exact endpoints in play
  endpoints: {
    authorize: authorizeUrl,
    exchange: exchangeUrl,
    authBase: authBaseUrl,
    deviceCode: deviceCodeUrl,
    deviceToken: deviceTokenUrl,
    consoleKeys: CONSOLE_KEYS_URL,
    consoleAuthorizedApps: CONSOLE_AUTHORIZED_APPS_URL,
  },
  redactSecret,
};
