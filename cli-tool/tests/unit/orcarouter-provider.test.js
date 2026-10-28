'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs-extra');

const provider = require('../../src/providers/orcarouter');
const {
  CredentialStore,
  DEFAULT_STORE_PATH,
} = require('../../src/providers/orcarouter/credential-store');
const {
  describeCredentialSources,
  credentialSource,
  endpoints,
} = require('../../src/providers/orcarouter/credential-sources');
const constants = require('../../src/providers/orcarouter/constants');
const client = require('../../src/orcarouter-client');
const cli = require('../../src/orcarouter-cli');

const KEY = 'sk-orca-integrationkey00000000000000000';
const FIXTURE = fs.readFileSync(
  path.join(__dirname, '..', 'fixtures', 'orcarouter', 'models.json'),
  'utf8'
);

function tmpStore(name) {
  return path.join(
    os.tmpdir(),
    `orca-prov-${name}-${crypto.randomBytes(6).toString('hex')}`,
    'credentials.json'
  );
}

function fakeFetch(body, status = 200) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url: String(url), init: init || {} });
    return { ok: status >= 200 && status < 300, status, text: async () => body };
  };
  impl.calls = calls;
  return impl;
}

describe('provider registration', () => {
  test('registers two named authentication methods, not a generic button', () => {
    const described = provider.describeProvider();
    const methods = described.authMethods;
    expect(methods.map((method) => method.kind).sort()).toEqual(['api_key', 'pkce']);
    expect(methods.find((method) => method.kind === 'api_key').id).toBe('orcarouter');
    expect(methods.find((method) => method.kind === 'api_key').label).toBe('OrcaRouter - API');
    expect(methods.find((method) => method.kind === 'pkce').id).toBe('orcarouter-oauth');
    expect(methods.find((method) => method.kind === 'pkce').label).toBe('OrcaRouter - Auth');
    expect(methods.find((method) => method.kind === 'pkce').flow).toBe('oauth2-pkce-s256');
  });

  test('the provider entry points at the documented endpoints', () => {
    const described = provider.describeProvider();
    expect(described.apiBaseUrl).toBe('https://api.orcarouter.ai/v1');
    expect(described.anthropicBaseUrl).toBe('https://api.orcarouter.ai');
    expect(described.authBaseUrl).toBe('https://www.orcarouter.ai');
    expect(described.modelsEndpoint).toBe('https://api.orcarouter.ai/v1/models');
    expect(described.envKeys.apiKey).toBe('ORCAROUTER_API_KEY');
    expect(described.keyPrefix).toBe('sk-orca-');
    expect(described.logo).toBe('https://www.orcarouter.ai/orca-logo-classic.png');
  });

  test('the auth endpoint never resolves to the inference origin', () => {
    expect(endpoints.authorize({})).toBe('https://www.orcarouter.ai/auth');
    expect(endpoints.exchange({})).toBe('https://www.orcarouter.ai/api/v1/auth/keys');
    for (const fn of [endpoints.authorize, endpoints.exchange, endpoints.deviceCode, endpoints.deviceToken]) {
      expect(fn({})).toContain('www.orcarouter.ai');
      expect(fn({})).not.toContain('api.orcarouter.ai');
    }
  });
});

describe('status reporting', () => {
  test('with no credential it reports both methods as available', () => {
    const status = provider.getStatus({ store: new CredentialStore({ filePath: tmpStore('s1'), env: {} }) });
    expect(status.credential.configured).toBe(false);
    expect(status.sources).toHaveLength(2);
    expect(status.sources.filter((source) => source.kind === 'api_key')).toHaveLength(1);
    expect(status.sources.filter((source) => source.kind === 'pkce')).toHaveLength(1);
  });

  test('with a credential it reports the masked key and never the key', () => {
    const filePath = tmpStore('s2');
    const store = new CredentialStore({ filePath, env: {} });
    store.save({ key: KEY, method: 'api_key' });
    const status = provider.getStatus({ store });
    expect(status.credential.configured).toBe(true);
    expect(status.credential.method).toBe('api_key');
    expect(status.credential.maskedKey).not.toBe(KEY);
    expect(JSON.stringify(status)).not.toContain(KEY);
    fs.removeSync(path.dirname(filePath));
  });
});

describe('Claude Code environment', () => {
  test('injects the Anthropic wire base and the token from either adapter', async () => {
    const filePath = tmpStore('env');
    const store = new CredentialStore({ filePath, env: {} });
    store.save({ key: KEY, method: 'pkce', userId: 'u' });

    const env = provider.getClaudeCodeEnvironment({ store, env: {} });
    expect(env.ANTHROPIC_BASE_URL).toBe('https://api.orcarouter.ai');
    expect(env.ANTHROPIC_AUTH_TOKEN).toBe(KEY);
    // Claude Code appends /v1/messages itself, so the base must not end in /v1
    expect(env.ANTHROPIC_BASE_URL.endsWith('/v1')).toBe(false);

    const status = provider.getStatus({ store });
    // the same env is produced regardless of which adapter stored the key
    expect(status.credential.method).toBe('pkce');
    fs.removeSync(path.dirname(filePath));
  });

  test('a credential marked needsReauth is refused instead of reused', () => {
    const filePath = tmpStore('reauth');
    const store = new CredentialStore({ filePath, env: {} });
    const record = store.save({ key: KEY, method: 'pkce' });
    store.markNeedsReauth({ status: 401, generation: record.generation });
    expect(() => provider.getClaudeCodeEnvironment({ store, env: {} })).toThrow(/rejected/);
    fs.removeSync(path.dirname(filePath));
  });

  test('with no credential it fails with an actionable error', () => {
    const store = new CredentialStore({ filePath: tmpStore('none'), env: {} });
    expect(() => provider.getClaudeCodeEnvironment({ store, env: {} })).toThrow(
      /No OrcaRouter credential/
    );
  });
});

describe('inference client', () => {
  test('routes to the OpenAI-compatible base with Bearer auth', async () => {
    const filePath = tmpStore('client');
    const store = new CredentialStore({ filePath, env: {} });
    store.save({ key: KEY, method: 'api_key' });
    const fetchImpl = fakeFetch(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }));

    const result = await client.chatCompletion({
      store,
      env: {},
      fetchImpl,
      model: 'deepseek/deepseek-v4-pro',
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(fetchImpl.calls[0].url).toBe('https://api.orcarouter.ai/v1/chat/completions');
    expect(fetchImpl.calls[0].init.headers.Authorization).toBe(`Bearer ${KEY}`);
    expect(result.payload.choices[0].message.content).toBe('ok');
    fs.removeSync(path.dirname(filePath));
  });

  test('a 401 marks exactly that generation for reauthentication and does not retry', async () => {
    const filePath = tmpStore('401');
    const store = new CredentialStore({ filePath, env: {} });
    const record = store.save({ key: KEY, method: 'pkce' });
    const fetchImpl = fakeFetch('{"error":"revoked"}', 401);

    await expect(
      client.chatCompletion({
        store,
        env: {},
        fetchImpl,
        model: 'm',
        messages: [],
      })
    ).rejects.toMatchObject({ code: constants.ERROR_CODES.needsReauth });

    // exactly one attempt: no retry loop, no refresh grant
    expect(fetchImpl.calls).toHaveLength(1);
    const after = store.load().credential;
    expect(after.needsReauth).toBe(true);
    expect(after.generation).toBe(record.generation);
    expect(after.key).toBe(record.key);
    fs.removeSync(path.dirname(filePath));
  });

  test('a late 401 from an old generation cannot poison a newer credential', async () => {
    const filePath = tmpStore('stale');
    const store = new CredentialStore({ filePath, env: {} });
    const stale = store.save({ key: KEY, method: 'pkce' });
    const fresh = store.save({ key: 'sk-orca-newerkey00000000000000000000000000', method: 'pkce' });

    const result = client.recordTerminalFailure(store, stale, 401);
    expect(result.changed).toBe(false);
    expect(store.load().credential.generation).toBe(fresh.generation);
    expect(store.load().credential.needsReauth).toBe(false);
    fs.removeSync(path.dirname(filePath));
  });

  test('429 is retryable and does not mark the credential', async () => {
    const filePath = tmpStore('429');
    const store = new CredentialStore({ filePath, env: {} });
    store.save({ key: KEY, method: 'api_key' });
    await expect(
      client.chatCompletion({
        store,
        env: {},
        fetchImpl: fakeFetch('{"error":"slow down"}', 429),
        model: 'm',
        messages: [],
      })
    ).rejects.toMatchObject({ code: constants.ERROR_CODES.rateLimited });
    expect(store.load().credential.needsReauth).toBe(false);
    fs.removeSync(path.dirname(filePath));
  });

  test('a 403 model-scope denial is not treated as credential revocation', async () => {
    const filePath = tmpStore('scope');
    const store = new CredentialStore({ filePath, env: {} });
    store.save({ key: KEY, method: 'api_key' });
    const body = JSON.stringify({
      error: {
        code: 'model_access_denied',
        message: 'This API key does not have access to model openai/gpt-5.5.',
        metadata: { reason: 'block_key_scope' },
      },
    });
    await expect(
      client.chatCompletion({
        store,
        env: {},
        fetchImpl: fakeFetch(body, 403),
        model: 'openai/gpt-5.5',
        messages: [],
      })
    ).rejects.toMatchObject({ code: constants.ERROR_CODES.modelNotAllowed });

    // the credential itself is untouched and still usable for other models
    expect(store.load().credential.needsReauth).toBe(false);
    expect(store.load().credential.key).toBe(KEY);
    fs.removeSync(path.dirname(filePath));
  });

  test('a plain 403 (no scope marker) still means reauthentication', async () => {
    const filePath = tmpStore('403');
    const store = new CredentialStore({ filePath, env: {} });
    store.save({ key: KEY, method: 'api_key' });
    await expect(
      client.chatCompletion({
        store,
        env: {},
        fetchImpl: fakeFetch('{"error":"forbidden"}', 403),
        model: 'm',
        messages: [],
      })
    ).rejects.toMatchObject({ code: constants.ERROR_CODES.needsReauth });
    expect(store.load().credential.needsReauth).toBe(true);
    fs.removeSync(path.dirname(filePath));
  });

  test('the key never appears in an error raised by the client', async () => {
    const filePath = tmpStore('leak');
    const store = new CredentialStore({ filePath, env: {} });
    store.save({ key: KEY, method: 'api_key' });
    let caught;
    try {
      await client.chatCompletion({
        store,
        env: {},
        fetchImpl: fakeFetch(`{"error":"bad key ${KEY}"}`, 500),
        model: 'm',
        messages: [],
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeDefined();
    expect(`${caught.message} ${JSON.stringify(caught.details || {})}`).not.toContain(KEY);
    fs.removeSync(path.dirname(filePath));
  });
});

describe('model options through the provider layer', () => {
  test('both credential sources yield the same catalog result', async () => {
    const first = await provider.getModelOptions(
      { capability: 'chat' },
      { store: new CredentialStore({ filePath: tmpStore('m1'), env: {} }), env: {}, fetchImpl: fakeFetch(FIXTURE) }
    );
    const filePath = tmpStore('m2');
    const store = new CredentialStore({ filePath, env: {} });
    store.save({ key: KEY, method: 'pkce' });
    const second = await provider.getModelOptions(
      { capability: 'chat' },
      { store, env: {}, fetchImpl: fakeFetch(FIXTURE) }
    );
    expect(first.options.map((o) => o.id)).toEqual(second.options.map((o) => o.id));
    expect(first.source).toBe('live');
    fs.removeSync(path.dirname(filePath));
  });

  test('the chat dropdown excludes image/video/rerank/embedding models', async () => {
    const result = await provider.getModelOptions(
      { capability: 'chat' },
      { store: new CredentialStore({ filePath: tmpStore('m3'), env: {} }), env: {}, fetchImpl: fakeFetch(FIXTURE) }
    );
    const list = result.options.map((option) => option.id);
    expect(list).toContain('openai/gpt-5.5');
    expect(list).not.toContain('some-vendor/image-gen-model');
    expect(list).not.toContain('some-vendor/video-gen-model');
    expect(list).not.toContain('some-vendor/embedding-model');
    expect(list).not.toContain('some-vendor/rerank-model');
  });

  test('the image dropdown excludes text chat models', async () => {
    const result = await provider.getModelOptions(
      { capability: 'image' },
      { store: new CredentialStore({ filePath: tmpStore('m4'), env: {} }), env: {}, fetchImpl: fakeFetch(FIXTURE) }
    );
    expect(result.options.map((option) => option.id)).toEqual(['some-vendor/image-gen-model']);
  });
});

describe('CLI surface', () => {
  test('both authentication flags are discoverable in the CLI definition', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'bin', 'create-claude-config.js'),
      'utf8'
    );
    expect(source).toContain('--orcarouter-api-key');
    expect(source).toContain('--orcarouter-connect');
    expect(source).toContain('--orcarouter-status');
    expect(source).toContain('--orcarouter-logout');
  });

  test('the dispatcher handles nothing when no OrcaRouter flag is present', async () => {
    await expect(cli.runOrcaRouterCommand({})).resolves.toBe(false);
  });

  test('capability parsing rejects an unknown capability', () => {
    expect(cli.parseCapability(undefined)).toEqual({ capability: 'chat', extraModalities: [] });
    expect(cli.parseCapability('chat+image')).toEqual({
      capability: 'chat',
      extraModalities: ['image'],
    });
    expect(() => cli.parseCapability('telepathy')).toThrow(/Unknown capability/);
  });

  test('--orcarouter-logout clears the store', () => {
    const filePath = tmpStore('logout');
    const store = new CredentialStore({ filePath, env: {} });
    store.save({ key: KEY, method: 'api_key' });
    expect(fs.existsSync(filePath)).toBe(true);
    cli.runLogout({ credentialFile: filePath, env: {} });
    expect(fs.existsSync(filePath)).toBe(false);
  });

  test('--orcarouter-api-key rejects a malformed key without storing it', async () => {
    const filePath = tmpStore('badkey');
    await cli.runApiKey({
      credentialFile: filePath,
      env: {},
      apiKey: 'not-an-orca-key',
      prompts: {},
    }).catch((error) => error);
    expect(fs.existsSync(filePath)).toBe(false);
  });

  test('the default credential path lives under ~/.claude', () => {
    expect(DEFAULT_STORE_PATH).toContain(path.join('.claude', 'orcarouter'));
  });

  test('credential sources are enumerable and addressable by provider id', () => {
    const sources = describeCredentialSources();
    expect(sources).toHaveLength(2);
    expect(credentialSource('orcarouter').method).toBe('api_key');
    expect(credentialSource('orcarouter-oauth').method).toBe('pkce');
    expect(() => credentialSource('nope')).toThrow(/Unknown OrcaRouter credential source/);
  });
});

describe('shipped presets', () => {
  const settingsDir = path.join(__dirname, '..', '..', 'components', 'settings', 'partnerships');

  test('an API-key preset and an account-login preset both exist', () => {
    const apikey = JSON.parse(fs.readFileSync(path.join(settingsDir, 'orcarouter.json'), 'utf8'));
    const oauth = JSON.parse(fs.readFileSync(path.join(settingsDir, 'orcarouter-oauth.json'), 'utf8'));
    for (const preset of [apikey, oauth]) {
      expect(preset.env.ANTHROPIC_BASE_URL).toBe('https://api.orcarouter.ai');
      // no /v1 suffix: Claude Code appends /v1/messages itself
      expect(preset.env.ANTHROPIC_BASE_URL.endsWith('/v1')).toBe(false);
      expect(preset.env.ANTHROPIC_AUTH_TOKEN).toBe('YOUR-ORCAROUTER-API-KEY');
      // never a real key
      expect(JSON.stringify(preset)).not.toMatch(/sk-orca-[a-z0-9]{16,}/i);
    }
    expect(apikey.description).toContain('console/token');
    expect(oauth.description).toContain('--orcarouter-connect');
    expect(oauth.description).toContain('PKCE');
  });
});
