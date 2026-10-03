'use strict';

const crypto = require('crypto');

const { LIMITS, ERROR_CODES, APP_NAME } = require('./constants');
const { safeError, scrub } = require('./redact');

/**
 * PKCE primitives (RFC 7636) and the two credential adapters.
 *
 * Both adapters implement the same `acquireCredential()` contract and return
 * the same shape, so the provider layer, the catalog client, and the CLI can
 * treat "paste a key" and "sign in with OrcaRouter" as one seam with two
 * implementations.
 *
 * Flow A (loopback redirect) is the default for a headed CLI on the user's own
 * machine. Flow B (out-of-band code) is used when no browser can reach a
 * loopback listener — SSH sessions, containers, CI — and is also what the user
 * gets if they pick "show me a code" on the consent screen. Both always send
 * S256, because a displayed code must be redeemable only by the process that
 * generated the verifier.
 */

function b64url(buffer) {
  return Buffer.from(buffer).toString('base64url');
}

/** Cryptographically random verifier, 43-128 characters after base64url. */
function createVerifier() {
  return b64url(crypto.randomBytes(32));
}

function createChallenge(verifier) {
  return b64url(crypto.createHash('sha256').update(verifier).digest());
}

function createState() {
  return b64url(crypto.randomBytes(16));
}

function createPkcePair() {
  const verifier = createVerifier();
  return { verifier, challenge: createChallenge(verifier), state: createState() };
}

/** Constant-time comparison; used for the Flow A `state` check. */
function safeEqual(a, b) {
  const left = Buffer.from(String(a === null || a === undefined ? '' : a));
  const right = Buffer.from(String(b === null || b === undefined ? '' : b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

/**
 * Build the consent URL. `callbackUrl` is either `oob` or a loopback URL.
 *
 * @param {{callbackUrl: string, codeChallenge: string, state: string,
 *          scope?: string, appName?: string, loginHint?: string,
 *          workspaceHint?: string, prompt?: string}} input
 * @param {string} authorizeEndpoint
 */
function buildAuthorizeUrl(input, authorizeEndpoint) {
  const url = new URL(authorizeEndpoint);
  url.searchParams.set('callback_url', input.callbackUrl);
  url.searchParams.set('code_challenge', input.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', input.state);
  url.searchParams.set('app_name', input.appName || APP_NAME);
  url.searchParams.set('scope', input.scope || 'api');
  if (input.loginHint) url.searchParams.set('login_hint', input.loginHint);
  if (input.workspaceHint) url.searchParams.set('workspace_hint', input.workspaceHint);
  if (input.prompt) url.searchParams.set('prompt', input.prompt);
  return url.toString();
}

/**
 * Read the granted scope out of an exchange response. The response reports what
 * was *granted*, not what was requested, so a narrower grant is surfaced rather
 * than assumed away.
 *
 * @param {object} body
 * @param {string} requested
 * @returns {{scope: string, downgraded: boolean}}
 */
function readGrantedScope(body, requested) {
  const granted = body && typeof body.scope === 'string' && body.scope ? body.scope : null;
  if (!granted) return { scope: requested || 'api', downgraded: false, reported: false };
  const requestedScopes = String(requested || 'api')
    .split(/[\s,]+/)
    .filter(Boolean);
  const grantedScopes = granted.split(/[\s,]+/).filter(Boolean);
  const missing = requestedScopes.filter((scope) => !grantedScopes.includes(scope));
  return { scope: granted, downgraded: missing.length > 0, missing, reported: true };
}

function classifyExchangeFailure(status, bodyText, known) {
  if (status === 400) {
    return safeError(
      'OrcaRouter rejected the exchange request: the code_challenge_method was not recognised ' +
        'or it differs from the one sent at authorize time.',
      { code: ERROR_CODES.codeRejected, status, details: { body: scrub(bodyText, known) }, known }
    );
  }
  if (status === 403) {
    return safeError(
      'OrcaRouter refused the authorization code: it is unknown, expired (10 minute TTL) or ' +
        'already used, or the code_verifier does not match the stored challenge. ' +
        'Run the connect flow again to obtain a fresh code.',
      { code: ERROR_CODES.codeRejected, status, details: { body: scrub(bodyText, known) }, known }
    );
  }
  if (status === 429) {
    return safeError(
      'OrcaRouter rate-limited this authorization. A user may issue at most 10 PKCE keys per ' +
        '24 hours; the stored key is reused across runs, so re-authorize only when it was revoked.',
      { code: ERROR_CODES.rateLimited, status, details: { body: scrub(bodyText, known) }, known }
    );
  }
  if (status >= 500) {
    return safeError(`OrcaRouter authorization service is unavailable (HTTP ${status}).`, {
      code: ERROR_CODES.network,
      status,
      details: { body: scrub(bodyText, known) },
      known,
    });
  }
  return safeError(`OrcaRouter exchange failed with HTTP ${status}.`, {
    code: ERROR_CODES.network,
    status,
    details: { body: scrub(bodyText, known) },
    known,
  });
}

/**
 * Exchange an authorization code for a durable API key.
 *
 * Always POSTs to the auth origin's `/api/v1/auth/keys` — never to the
 * inference origin. Form encoding is accepted by the endpoint too; JSON is used
 * because every other request in this repository is JSON.
 *
 * @param {{code: string, verifier: string, authEndpoint: string,
 *          fetchImpl?: Function, timeoutMs?: number}} input
 * @returns {Promise<{key: string, userId: string|null, scope: string,
 *                    downgraded: boolean, method: string}>}
 */
async function exchangeCodeForKey(input) {
  const doFetch = input.fetchImpl || globalThis.fetch;
  const known = [input.verifier, input.code];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs || LIMITS.exchangeTimeoutMs);

  let response;
  try {
    response = await doFetch(input.authEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        code: input.code,
        code_verifier: input.verifier,
        code_challenge_method: 'S256',
      }),
      signal: controller.signal,
    });
  } catch (error) {
    throw safeError(
      `Could not reach OrcaRouter to exchange the authorization code: ${error.message}. ` +
        'Check your network connection and proxy settings, then retry.',
      { code: ERROR_CODES.network, known }
    );
  } finally {
    clearTimeout(timer);
  }

  const bodyText = await response.text();
  if (!response.ok) {
    throw classifyExchangeFailure(response.status, bodyText, known);
  }

  let body;
  try {
    body = JSON.parse(bodyText);
  } catch (_) {
    throw safeError('OrcaRouter returned a response that is not valid JSON.', {
      code: ERROR_CODES.network,
      status: response.status,
      known,
    });
  }

  if (!body || typeof body.key !== 'string' || body.key.length === 0) {
    throw safeError('OrcaRouter did not return a key in the exchange response.', {
      code: ERROR_CODES.codeRejected,
      status: response.status,
      known,
    });
  }

  const granted = readGrantedScope(body, input.requestedScope || 'api');
  return {
    key: body.key,
    userId: body.user_id ? String(body.user_id) : null,
    scope: granted.scope,
    downgraded: granted.downgraded,
    missingScopes: granted.missing || [],
    method: 'pkce',
  };
}

/**
 * Flow B: out-of-band code. The user authorizes in a browser and pastes the
 * displayed code back.
 *
 * @param {{authEndpoint: string, prompts: {showUrl(url: string): void,
 *          askForCode(): Promise<string>}, openBrowser?: Function,
 *          fetchImpl?: Function, appName?: string, scope?: string}} input
 */
async function connectWithOutOfBandCode(input) {
  const pkce = createPkcePair();
  const url = buildAuthorizeUrl(
    {
      callbackUrl: 'oob',
      codeChallenge: pkce.challenge,
      state: pkce.state,
      appName: input.appName,
      scope: input.scope || 'api',
      loginHint: input.loginHint,
    },
    input.authEndpoint
  );

  input.prompts.showUrl(url);
  if (input.openBrowser) {
    try {
      await input.openBrowser(url);
    } catch (_) {
      /* the URL was already shown; a failed browser launch is not fatal */
    }
  }

  const pasted = await input.prompts.askForCode();
  const code = String(pasted || '').trim();
  if (!code) {
    throw safeError('No authorization code was provided.', {
      code: ERROR_CODES.cancelled,
      known: [pkce.verifier],
    });
  }

  return exchangeCodeForKey({
    code,
    verifier: pkce.verifier,
    authEndpoint: input.authEndpoint,
    fetchImpl: input.fetchImpl,
    requestedScope: input.scope || 'api',
  });
}

/**
 * Flow A: loopback redirect. A server is listening on 127.0.0.1 before the
 * browser opens, so the redirect never races the listener. The response page is
 * served, then `state` is compared in constant time before the code is used.
 *
 * @param {{authEndpoint: string, serverFactory: Function,
 *          openBrowser: Function, fetchImpl?: Function, appName?: string,
 *          scope?: string, timeoutMs?: number, onAuthorizeUrl?: Function}} input
 */
async function connectWithLoopback(input) {
  const pkce = createPkcePair();
  const known = [pkce.verifier];
  const timeoutMs = input.timeoutMs || LIMITS.connectTimeoutMs;

  const listener = await input.serverFactory({
    expectedState: pkce.state,
    stateEquals: safeEqual,
  });

  let settled = false;
  let timer = null;
  let closeTimer = null;

  const cleanup = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (closeTimer) clearTimeout(closeTimer);
    closeTimer = null;
    try {
      listener.close();
    } catch (_) {
      /* already closed */
    }
  };

  try {
    const url = buildAuthorizeUrl(
      {
        callbackUrl: listener.callbackUrl,
        codeChallenge: pkce.challenge,
        state: pkce.state,
        appName: input.appName,
        scope: input.scope || 'api',
      },
      input.authEndpoint
    );
    if (input.onAuthorizeUrl) input.onAuthorizeUrl(url);

    const callback = listener.result.then((payload) => {
      settled = true;
      return payload;
    });

    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(
          safeError(
            `Timed out after ${Math.round(timeoutMs / 1000)}s waiting for the OrcaRouter ` +
              'authorization redirect. Start the connect flow again, or use ' +
              '`--orcarouter-connect --no-browser` to paste a code instead.',
            { code: ERROR_CODES.timeout, known }
          )
        );
      }, timeoutMs);
    });

    // Attach the race before the browser is opened: a browser that returns
    // immediately (or refuses) must not produce an unobserved rejection.
    const race = Promise.race([callback, timeout]);
    race.catch(() => {});

    // Open the browser first, then keep the listener open briefly so the
    // requesting connection can be accepted and closed cleanly before the
    // server is torn down.
    await input.openBrowser(url);

    let payload;
    try {
      payload = await race;
    } catch (error) {
      cleanup();
      throw error;
    }
    clearTimeout(timer);
    timer = null;

    if (payload.error) {
      cleanup();
      throw safeError(`OrcaRouter authorization was denied (${payload.error}).`, {
        code: payload.error === 'access_denied' ? ERROR_CODES.denied : ERROR_CODES.network,
        known,
      });
    }
    if (!payload.code) {
      cleanup();
      throw safeError('OrcaRouter redirected back without an authorization code.', {
        code: ERROR_CODES.codeRejected,
        known,
      });
    }

    const result = await exchangeCodeForKey({
      code: payload.code,
      verifier: pkce.verifier,
      authEndpoint: input.authEndpoint,
      fetchImpl: input.fetchImpl,
      requestedScope: input.scope || 'api',
    });
    cleanup();
    return result;
  } catch (error) {
    cleanup();
    throw error;
  } finally {
    if (settled) cleanup();
  }
}

/**
 * Adapt an exchange result into the store's record shape. Kept here so both
 * adapters produce byte-identical records.
 *
 * @param {{key: string, userId?: string|null, scope?: string, method: string}} result
 * @param {{account?: string}} [meta]
 */
function toCredentialRecord(result, meta = {}) {
  return {
    key: result.key,
    method: result.method,
    scope: result.scope || 'api',
    userId: result.userId || null,
    account: meta.account || result.userId || 'default',
  };
}

module.exports = {
  b64url,
  createVerifier,
  createChallenge,
  createState,
  createPkcePair,
  safeEqual,
  buildAuthorizeUrl,
  readGrantedScope,
  classifyExchangeFailure,
  exchangeCodeForKey,
  connectWithOutOfBandCode,
  connectWithLoopback,
  toCredentialRecord,
};
