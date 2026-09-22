'use strict';

/**
 * PKCE protocol tests.
 *
 * Everything here runs against fake credentials and a local fake auth server.
 * No real authorization codes, keys, or user consent are involved.
 */

const http = require('http');
const crypto = require('crypto');
const path = require('path');
const os = require('os');
const fs = require('fs-extra');

const {
  b64url,
  createVerifier,
  createChallenge,
  createState,
  createPkcePair,
  buildAuthorizeUrl,
  readGrantedScope,
  exchangeCodeForKey,
  connectWithOutOfBandCode,
  connectWithLoopback,
  safeEqual,
} = require('../../src/providers/orcarouter/pkce');
const { startLoopbackListener } = require('../../src/providers/orcarouter/loopback-listener');
const { CredentialStore } = require('../../src/providers/orcarouter/credential-store');
const constants = require('../../src/providers/orcarouter/constants');

const FAKE_KEY = 'sk-orca-fakekeyfortests0000000000000000';

// Node 19+ enables keep-alive on the global agent, which would hold the test
// process open for a few seconds after the last assertion. The callback
// requests in this file are one-shot, so keep-alive is off.
http.globalAgent.keepAlive = false;

function tmpStorePath(name) {
  return path.join(
    os.tmpdir(),
    `orca-test-${name}-${crypto.randomBytes(6).toString('hex')}`,
    'credentials.json'
  );
}

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

function captureFetch(handler) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url: String(url), init: init || {} });
    return handler(String(url), init || {}, calls.length);
  };
  impl.calls = calls;
  return impl;
}

describe('PKCE primitives', () => {
  test('verifier is fresh, high-entropy and base64url without padding', () => {
    const first = createVerifier();
    const second = createVerifier();
    expect(first).not.toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(first).not.toContain('=');
    // 32 random bytes -> 43 base64url characters, inside RFC 7636's 43..128
    expect(first.length).toBe(43);
  });

  test('challenge is base64url(sha256(verifier)) with no padding', () => {
    const verifier = 'fixed-verifier-for-the-hash-assertion';
    const expected = crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(createChallenge(verifier)).toBe(expected);
    expect(createChallenge(verifier)).not.toContain('=');
    // must equal the RFC 7636 appendix B vector
    expect(createChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
    );
  });

  test('state is random per attempt and compared in constant time', () => {
    const a = createState();
    const b = createState();
    expect(a).not.toBe(b);
    expect(safeEqual(a, a)).toBe(true);
    expect(safeEqual(a, b)).toBe(false);
    expect(safeEqual('short', 'a-much-longer-value')).toBe(false);
    expect(safeEqual(undefined, 'x')).toBe(false);
  });

  test('createPkcePair never reuses a verifier', () => {
    const pairs = new Set();
    for (let i = 0; i < 50; i += 1) pairs.add(createPkcePair().verifier);
    expect(pairs.size).toBe(50);
  });
});

describe('authorize URL', () => {
  test('targets the auth origin, uses /auth and always asks for S256', () => {
    const url = new URL(
      buildAuthorizeUrl(
        {
          callbackUrl: 'http://127.0.0.1:51733/cb',
          codeChallenge: 'challenge-value',
          state: 'state-value',
          appName: 'Claude Code Templates',
        },
        constants.authorizeUrl({})
      )
    );

    expect(url.origin).toBe('https://www.orcarouter.ai');
    expect(url.pathname).toBe('/auth');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBe('challenge-value');
    expect(url.searchParams.get('state')).toBe('state-value');
    expect(url.searchParams.get('callback_url')).toBe('http://127.0.0.1:51733/cb');
    expect(url.searchParams.get('scope')).toBe('api');
    expect(url.searchParams.get('app_name')).toBe('Claude Code Templates');
    // the verifier itself must never appear on the URL
    expect(url.toString()).not.toContain('verifier');
  });

  test('Flow B asks for the literal oob callback and still sends S256', () => {
    const url = new URL(
      buildAuthorizeUrl(
        { callbackUrl: 'oob', codeChallenge: 'c', state: 's' },
        constants.authorizeUrl({})
      )
    );
    expect(url.searchParams.get('callback_url')).toBe('oob');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });
});

describe('origins', () => {
  test('auth and API origins are separate and never derived from each other', () => {
    expect(constants.authBaseUrl({})).toBe('https://www.orcarouter.ai');
    expect(constants.apiBaseUrl({})).toBe('https://api.orcarouter.ai');
    expect(constants.openAiBaseUrl({})).toBe('https://api.orcarouter.ai/v1');
    expect(constants.authorizeUrl({})).toBe('https://www.orcarouter.ai/auth');
    expect(constants.exchangeUrl({})).toBe('https://www.orcarouter.ai/api/v1/auth/keys');
    expect(constants.modelsUrl({})).toBe('https://api.orcarouter.ai/v1/models');
    // the classic mistake: the auth path must not live on the inference origin
    expect(constants.exchangeUrl({})).not.toContain('api.orcarouter.ai');
    expect(constants.modelsUrl({})).not.toContain('www.orcarouter.ai');
  });

  test('explicit overrides win over the shared self-hosted fallback', () => {
    const env = {
      ORCA_BASE_URL: 'https://shared.example.com',
      ORCA_AUTH_BASE_URL: 'https://auth.example.com',
      ORCA_API_BASE_URL: 'https://api.example.com',
    };
    expect(constants.authBaseUrl(env)).toBe('https://auth.example.com');
    expect(constants.apiBaseUrl(env)).toBe('https://api.example.com');
  });

  test('a shared self-hosted base is used by both origins when nothing else is set', () => {
    const env = { ORCA_BASE_URL: 'https://one.example.com' };
    expect(constants.authBaseUrl(env)).toBe('https://one.example.com');
    expect(constants.apiBaseUrl(env)).toBe('https://one.example.com');
    expect(constants.openAiBaseUrl(env)).toBe('https://one.example.com/v1');
  });

  test('plain HTTP is refused for remote origins but allowed on loopback', () => {
    expect(() => constants.authBaseUrl({ ORCA_AUTH_BASE_URL: 'http://evil.example.com' })).toThrow(
      /non-HTTPS/
    );
    expect(constants.authBaseUrl({ ORCA_AUTH_BASE_URL: 'http://127.0.0.1:8080' })).toBe(
      'http://127.0.0.1:8080'
    );
    expect(constants.authBaseUrl({ ORCA_AUTH_BASE_URL: 'http://localhost:8080' })).toBe(
      'http://localhost:8080'
    );
  });
});

describe('scope handling', () => {
  test('reports a downgrade instead of assuming the requested scope', () => {
    expect(readGrantedScope({ scope: 'api' }, 'api')).toMatchObject({
      scope: 'api',
      downgraded: false,
    });
    expect(readGrantedScope({ scope: 'connector' }, 'api')).toMatchObject({
      scope: 'connector',
      downgraded: true,
    });
    // an older server that reports nothing must not be read as a downgrade
    expect(readGrantedScope({}, 'api')).toMatchObject({ scope: 'api', downgraded: false });
  });
});

describe('code exchange', () => {
  const authEndpoint = 'https://www.orcarouter.ai/api/v1/auth/keys';

  test('posts code, verifier and S256 to the auth origin and returns the key', async () => {
    const fetchImpl = captureFetch(() =>
      jsonResponse({ key: FAKE_KEY, user_id: '12345', scope: 'api' })
    );
    const result = await exchangeCodeForKey({
      code: 'fake-code',
      verifier: 'fake-verifier-value-for-tests',
      authEndpoint,
      fetchImpl,
    });

    expect(fetchImpl.calls).toHaveLength(1);
    expect(fetchImpl.calls[0].url).toBe(authEndpoint);
    expect(fetchImpl.calls[0].init.method).toBe('POST');
    const body = JSON.parse(fetchImpl.calls[0].init.body);
    expect(body).toEqual({
      code: 'fake-code',
      code_verifier: 'fake-verifier-value-for-tests',
      code_challenge_method: 'S256',
    });
    expect(result.key).toBe(FAKE_KEY);
    expect(result.method).toBe('pkce');
    expect(result.scope).toBe('api');
  });

  test('403 (expired / reused / mismatched verifier) is a typed rejection', async () => {
    await expect(
      exchangeCodeForKey({
        code: 'fake',
        verifier: 'fake-verifier-value-for-tests',
        authEndpoint,
        fetchImpl: captureFetch(() => jsonResponse({ error: 'Invalid code or code_verifier' }, 403)),
      })
    ).rejects.toMatchObject({ code: constants.ERROR_CODES.codeRejected, status: 403 });
  });

  test('400 (challenge method mismatch) is a typed rejection', async () => {
    await expect(
      exchangeCodeForKey({
        code: 'fake',
        verifier: 'v',
        authEndpoint,
        fetchImpl: captureFetch(() => jsonResponse({}, 400)),
      })
    ).rejects.toMatchObject({ code: constants.ERROR_CODES.codeRejected, status: 400 });
  });

  test('429 is reported as rate limiting with an actionable message', async () => {
    await expect(
      exchangeCodeForKey({
        code: 'fake',
        verifier: 'v',
        authEndpoint,
        fetchImpl: captureFetch(() => jsonResponse({}, 429)),
      })
    ).rejects.toMatchObject({ code: constants.ERROR_CODES.rateLimited, status: 429 });
  });

  test('a network failure terminates instead of hot-looping', async () => {
    const fetchImpl = captureFetch(() => {
      throw new Error('ECONNREFUSED');
    });
    await expect(
      exchangeCodeForKey({ code: 'fake', verifier: 'verifier-value', authEndpoint, fetchImpl })
    ).rejects.toMatchObject({ code: constants.ERROR_CODES.network });
    expect(fetchImpl.calls).toHaveLength(1);
  });

  test('a non-JSON body is refused rather than parsed loosely', async () => {
    await expect(
      exchangeCodeForKey({
        code: 'fake',
        verifier: 'verifier-value',
        authEndpoint,
        fetchImpl: captureFetch(() => jsonResponse('<html>nope</html>', 200)),
      })
    ).rejects.toMatchObject({ code: constants.ERROR_CODES.network });
  });

  test('a 200 without a key is a rejection, not a silent success', async () => {
    await expect(
      exchangeCodeForKey({
        code: 'fake',
        verifier: 'verifier-value',
        authEndpoint,
        fetchImpl: captureFetch(() => jsonResponse({ user_id: '1', scope: 'api' })),
      })
    ).rejects.toMatchObject({ code: constants.ERROR_CODES.codeRejected });
  });

  test('the verifier never appears in an error message or details', async () => {
    const verifier = 'super-secret-verifier-that-must-not-leak';
    let caught;
    try {
      await exchangeCodeForKey({
        code: 'the-code',
        verifier,
        authEndpoint,
        fetchImpl: captureFetch(() =>
          jsonResponse({ error: `verifier ${verifier} mismatched` }, 403)
        ),
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeDefined();
    const serialised = `${caught.message} ${JSON.stringify(caught.details || {})}`;
    expect(serialised).not.toContain(verifier);
    expect(serialised).not.toContain('the-code');
  });
});

describe('Flow B (out-of-band code)', () => {
  test('shows the authorize URL, exchanges the pasted code and persists the key', async () => {
    // env: {} — an ambient ORCAROUTER_API_KEY would otherwise win over the
    // store, which is intended behaviour and separately asserted below.
    const store = new CredentialStore({ filePath: tmpStorePath('oob'), env: {} });
    const shown = [];
    const fetchImpl = captureFetch(() =>
      jsonResponse({ key: FAKE_KEY, user_id: 'u-1', scope: 'api' })
    );

    const result = await connectWithOutOfBandCode({
      authEndpoint: constants.authorizeUrl({}),
      prompts: {
        showUrl: (url) => shown.push(url),
        askForCode: async () => '  fake-pasted-code  ',
      },
      fetchImpl,
    });

    expect(shown).toHaveLength(1);
    const url = new URL(shown[0]);
    expect(url.origin).toBe('https://www.orcarouter.ai');
    expect(url.searchParams.get('callback_url')).toBe('oob');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    // the URL carries the challenge, never the verifier
    expect(url.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(shown[0]).not.toContain(JSON.parse(fetchImpl.calls[0].init.body).code_verifier);

    const body = JSON.parse(fetchImpl.calls[0].init.body);
    expect(body.code).toBe('fake-pasted-code');
    expect(createChallenge(body.code_verifier)).toBe(url.searchParams.get('code_challenge'));

    const record = store.save({
      key: result.key,
      method: 'pkce',
      scope: result.scope,
      userId: result.userId,
      account: result.userId ? `user:${result.userId}` : 'pkce',
    });
    expect(record.key).toBe(FAKE_KEY);
    expect(store.get().userId).toBe('u-1');
  });

  test('an empty paste is cancelled, not sent as a code', async () => {
    const fetchImpl = captureFetch(() => jsonResponse({ key: FAKE_KEY }));
    await expect(
      connectWithOutOfBandCode({
        authEndpoint: constants.authorizeUrl({}),
        prompts: { showUrl: () => {}, askForCode: async () => '   ' },
        fetchImpl,
      })
    ).rejects.toMatchObject({ code: constants.ERROR_CODES.cancelled });
    expect(fetchImpl.calls).toHaveLength(0);
  });
});

describe('Flow A (loopback redirect)', () => {
  const authEndpoint = constants.authorizeUrl({});

  test('binds loopback first, compares state, and only then exchanges the code', async () => {
    const seen = {};
    const result = await connectWithLoopback({
      authEndpoint,
      serverFactory: (options) => startLoopbackListener(options),
      openBrowser: async (url) => {
        seen.url = url;
        const target = new URL(url);
        // simulate the browser being redirected back
        const callback = new URL(target.searchParams.get('callback_url'));
        callback.searchParams.set('state', target.searchParams.get('state'));
        callback.searchParams.set('code', 'fake-loopback-code');
        const response = await new Promise((resolve, reject) => {
          http
            .get(callback, (res) => {
              let body = '';
              res.on('data', (chunk) => {
                body += chunk;
              });
              res.on('end', () => resolve({ status: res.statusCode, body }));
            })
            .on('error', reject);
        });
        seen.callback = response;
      },
      fetchImpl: captureFetch(() => jsonResponse({ key: FAKE_KEY, user_id: 'u-2', scope: 'api' })),
      appName: 'Claude Code Templates',
    });

    expect(result.key).toBe(FAKE_KEY);
    const url = new URL(seen.url);
    expect(url.origin).toBe('https://www.orcarouter.ai');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('callback_url')).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/cb$/);
    // the browser got a page it can read instead of a blank window
    expect(seen.callback.status).toBe(200);
    expect(seen.callback.body).toContain('close this tab');
  });

  test('a mismatched state is refused and the code is never exchanged', async () => {
    const fetchImpl = captureFetch(() => jsonResponse({ key: FAKE_KEY }));
    let refusal = null;

    await expect(
      connectWithLoopback({
        authEndpoint,
        serverFactory: (options) => startLoopbackListener(options),
        openBrowser: async (url) => {
          const target = new URL(url);
          const callback = new URL(target.searchParams.get('callback_url'));
          callback.searchParams.set('state', 'attacker-supplied-state');
          callback.searchParams.set('code', 'stolen-code');
          refusal = await new Promise((resolve, reject) => {
            http
              .get(callback, (res) => {
                let body = '';
                res.on('data', (c) => {
                  body += c;
                });
                res.on('end', () => resolve({ status: res.statusCode, body }));
              })
              .on('error', reject);
          });
        },
        fetchImpl,
      })
    ).rejects.toMatchObject({ code: constants.ERROR_CODES.stateMismatch });

    expect(refusal.status).toBe(400);
    expect(refusal.body).toContain('did not match');
    expect(fetchImpl.calls).toHaveLength(0);
  });

  test('denial from the consent screen ends the flow cleanly', async () => {
    await expect(
      connectWithLoopback({
        authEndpoint,
        serverFactory: (options) => startLoopbackListener(options),
        openBrowser: async (url) => {
          const target = new URL(url);
          const callback = new URL(target.searchParams.get('callback_url'));
          callback.searchParams.set('state', target.searchParams.get('state'));
          callback.searchParams.set('error', 'access_denied');
          await new Promise((resolve, reject) => {
            http.get(callback, (res) => {
              res.resume();
              res.on('end', resolve);
            }).on('error', reject);
          });
        },
        fetchImpl: captureFetch(() => jsonResponse({ key: FAKE_KEY })),
      })
    ).rejects.toMatchObject({ code: constants.ERROR_CODES.denied });
  });

  test('a listener timeout releases the socket and reports an actionable error', async () => {
    const servers = [];
    await expect(
      connectWithLoopback({
        authEndpoint,
        serverFactory: async (options) => {
          const listener = await startLoopbackListener(options);
          servers.push(listener);
          return listener;
        },
        openBrowser: async () => {},
        timeoutMs: 150,
        fetchImpl: captureFetch(() => jsonResponse({ key: FAKE_KEY })),
      })
    ).rejects.toMatchObject({ code: constants.ERROR_CODES.timeout });
    expect(servers[0].closed).toBe(true);
  });

  test('the listener refuses an unauthenticated request on a random path', async () => {
    const listener = await startLoopbackListener({ expectedState: 'expected' });
    const port = listener.port;
    const result = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}/not-cb`, (res) => {
        res.resume();
        res.on('end', () => resolve(res.statusCode));
      }).on('error', reject);
    });
    expect(result).toBe(404);
    listener.close();
  });

  test('explicit cancellation rejects with a cancelled code', async () => {
    const listener = await startLoopbackListener({ expectedState: 'expected' });
    const pending = listener.result;
    listener.cancel();
    await expect(pending).rejects.toMatchObject({ code: constants.ERROR_CODES.cancelled });
    expect(listener.closed).toBe(true);
  });
});

describe('connect adapters through the shared credential seam', () => {
  test('PKCE adapter stores through the same store the API-key adapter uses', async () => {
    const filePath = tmpStorePath('seam');
    const store = new CredentialStore({ filePath, env: {} });
    const { pkceSource, apiKeySource } = require('../../src/providers/orcarouter/credential-sources');

    const pkceResult = await pkceSource.acquire({
      store,
      flow: 'oob',
      prompts: { showUrl: () => {}, askForCode: async () => 'fake-code' },
      fetchImpl: captureFetch(() => jsonResponse({ key: FAKE_KEY, user_id: '7', scope: 'api' })),
    });
    expect(pkceResult.method).toBe('pkce');

    const afterPkce = store.load().credential;
    expect(afterPkce.method).toBe('pkce');
    expect(afterPkce.userId).toBe('7');

    const apiResult = await apiKeySource.acquire({
      store,
      apiKey: 'sk-orca-secondkey0000000000000000000000',
    });
    expect(apiResult.method).toBe('api_key');
    expect(store.get().method).toBe('api_key');

    // clear() is available to both, and the store never keeps the old key
    expect(store.clear()).toBe(true);
    expect(store.get()).toBeNull();
    fs.removeSync(path.dirname(filePath));
  });

  test('both adapters produce the record shape the client consumes', async () => {
    const { apiKeySource, pkceSource } = require('../../src/providers/orcarouter/credential-sources');
    const cases = [
      [
        apiKeySource,
        { apiKey: 'sk-orca-apikey0000000000000000000000000', prompts: {} },
        { key: FAKE_KEY },
      ],
      [
        pkceSource,
        {
          flow: 'oob',
          prompts: { showUrl: () => {}, askForCode: async () => 'fake-code' },
          fetchImpl: captureFetch(() => jsonResponse({ key: FAKE_KEY, user_id: '9', scope: 'api' })),
        },
        {},
      ],
    ];

    const shapes = [];
    for (const [source, ctxInput] of cases) {
      const store = new CredentialStore({ filePath: tmpStorePath('shape'), env: {} });
      await source.acquire({ store, ...ctxInput });
      const credential = store.get();
      shapes.push(Object.keys(credential).sort().join(','));
      expect(credential.key).toMatch(/^sk-orca-/);
    }
    expect(shapes[0]).toBe(shapes[1]);
  });
});

describe('device grant (optional Flow C)', () => {
  const { connectWithDeviceGrant } = require('../../src/providers/orcarouter/credential-sources');

  test('branches on the error field: pending, then success', async () => {
    let polls = 0;
    const fetchImpl = async (url, init) => {
      if (String(url).includes('device/code')) {
        return jsonResponse({
          device_code: 'fake-device-code',
          user_code: 'ABCD-EFGH',
          verification_uri: 'https://www.orcarouter.ai/device',
          verification_uri_complete: 'https://www.orcarouter.ai/device?code=ABCD-EFGH',
          expires_in: 600,
          interval: 1,
        });
      }
      polls += 1;
      if (polls === 1) return jsonResponse({ error: 'authorization_pending' });
      if (polls === 2) return jsonResponse({ error: 'slow_down' });
      return jsonResponse({ key: FAKE_KEY, scope: 'api' });
    };
    const shown = [];
    const result = await connectWithDeviceGrant({
      fetchImpl,
      prompts: { showDeviceInstructions: (info) => shown.push(info) },
      sleep: async () => {},
    });
    expect(result.key).toBe(FAKE_KEY);
    expect(polls).toBe(3);
    // the complete URI is printed as given, never rebuilt
    expect(shown[0].verificationUriComplete).toBe('https://www.orcarouter.ai/device?code=ABCD-EFGH');
  });

  test('access_denied stops immediately', async () => {
    const fetchImpl = async (url) => {
      if (String(url).includes('device/code')) {
        return jsonResponse({ device_code: 'd', user_code: 'X', verification_uri: 'u', expires_in: 60, interval: 1 });
      }
      return jsonResponse({ error: 'access_denied' });
    };
    await expect(
      connectWithDeviceGrant({
        fetchImpl,
        prompts: { showDeviceInstructions: () => {} },
        sleep: async () => {},
      })
    ).rejects.toMatchObject({ code: constants.ERROR_CODES.denied });
  });
});
