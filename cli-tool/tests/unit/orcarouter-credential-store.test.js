'use strict';

const path = require('path');
const os = require('os');
const crypto = require('crypto');
const fs = require('fs-extra');

const {
  CredentialStore,
  validateApiKeyShape,
  isTerminalAuthFailure,
} = require('../../src/providers/orcarouter/credential-store');
const { redactSecret, scrub, redactDeep, safeError } = require('../../src/providers/orcarouter/redact');

const KEY_A = 'sk-orca-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const KEY_B = 'sk-orca-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function tmpPath(name) {
  return path.join(
    os.tmpdir(),
    `orca-store-${name}-${crypto.randomBytes(6).toString('hex')}`,
    'credentials.json'
  );
}

describe('credential store', () => {
  test('saves, reads, and clears a key without exposing it', () => {
    const filePath = tmpPath('basic');
    const store = new CredentialStore({ filePath, env: {} });

    store.save({ key: KEY_A, method: 'api_key' });
    const read = store.get();
    expect(read.key).toBe(KEY_A);
    expect(read.method).toBe('api_key');
    expect(read.source).toBe(undefined); // comes from the store, not the env

    const described = store.describe();
    expect(described.configured).toBe(true);
    expect(described.maskedKey).toBe(redactSecret(KEY_A));
    expect(JSON.stringify(described)).not.toContain(KEY_A);

    expect(store.clear()).toBe(true);
    expect(store.get()).toBeNull();
    expect(store.clear()).toBe(false);
    fs.removeSync(path.dirname(filePath));
  });

  test('the file is written with owner-only permissions', () => {
    const filePath = tmpPath('perms');
    const store = new CredentialStore({ filePath, env: {} });
    store.save({ key: KEY_A, method: 'pkce', userId: 'u1' });
    const mode = fs.statSync(filePath).mode & 0o777;
    expect(mode).toBe(0o600);
    fs.removeSync(path.dirname(filePath));
  });

  test('rejects a key that is not an sk-orca- key', () => {
    const store = new CredentialStore({ filePath: tmpPath('bad'), env: {} });
    expect(() => store.save({ key: 'sk-ant-oops', method: 'api_key' })).toThrow(/invalid OrcaRouter key/);
    expect(() => store.save({ key: '', method: 'api_key' })).toThrow();
    expect(() => store.save({ key: KEY_A, method: 'telepathy' })).toThrow(/Unknown credential method/);
  });

  test('the environment wins over the store and is never written to disk', () => {
    const filePath = tmpPath('env');
    const store = new CredentialStore({ filePath, env: { ORCAROUTER_API_KEY: KEY_B } });
    store.save({ key: KEY_A, method: 'api_key' });
    const read = store.get();
    expect(read.key).toBe(KEY_B);
    expect(read.source).toBe('env');
    // the store on disk is untouched
    const onDisk = fs.readFileSync(filePath, 'utf8');
    expect(onDisk).toContain(KEY_A);
    expect(onDisk).not.toContain(KEY_B);
    fs.removeSync(path.dirname(filePath));
  });

  test('a malformed env key is reported instead of used', () => {
    const store = new CredentialStore({ filePath: tmpPath('badenv'), env: { ORCAROUTER_API_KEY: 'nope' } });
    expect(() => store.get()).toThrow(/malformed/);
  });

  test('a corrupt store file degrades to "not configured" instead of crashing', () => {
    const filePath = tmpPath('corrupt');
    fs.ensureDirSync(path.dirname(filePath));
    fs.writeFileSync(filePath, '{ not json at all');
    const store = new CredentialStore({ filePath, env: {} });
    expect(store.get()).toBeNull();
    expect(store.describe().configured).toBe(false);
    fs.removeSync(path.dirname(filePath));
  });

  test('shape validation is format-only', () => {
    expect(validateApiKeyShape(KEY_A)).toEqual({ ok: true });
    expect(validateApiKeyShape('sk-orca-short')).toMatchObject({ ok: false });
    expect(validateApiKeyShape('sk-orca-aaaaaaaaaaaaaaaaaaaa aaaa')).toMatchObject({ ok: false });
    expect(validateApiKeyShape(null)).toMatchObject({ ok: false, reason: 'empty' });
  });
});

describe('terminal reauthentication is generation-safe', () => {
  test('only the generation that made the rejected request is marked', () => {
    const filePath = tmpPath('gen');
    const store = new CredentialStore({ filePath, env: {} });

    const first = store.save({ key: KEY_A, method: 'pkce', userId: 'u1' });
    const staleGeneration = first.generation;

    // A newer login replaces the credential.
    const second = store.save({ key: KEY_B, method: 'pkce', userId: 'u1' });
    expect(second.generation).not.toBe(staleGeneration);

    // A late 401 from the old request must not poison the new credential.
    const late = store.markNeedsReauth({ status: 401, generation: staleGeneration });
    expect(late.changed).toBe(false);
    expect(store.get().needsReauth).toBe(false);

    // The current generation is marked when it is the one that failed.
    const current = store.markNeedsReauth({ status: 401, generation: second.generation });
    expect(current.changed).toBe(true);
    expect(store.get().needsReauth).toBe(true);
    // the secret is preserved until a successful replacement
    expect(store.get().key).toBe(KEY_B);
    fs.removeSync(path.dirname(filePath));
  });

  test('a revoked durable key is marked, not refreshed', () => {
    const filePath = tmpPath('revoked');
    const store = new CredentialStore({ filePath, env: {} });
    store.save({ key: KEY_A, method: 'pkce' });
    const before = store.load().credential;
    store.markNeedsReauth({ status: 401, generation: before.generation });
    const after = store.load().credential;

    expect(after.needsReauth).toBe(true);
    // no refresh fields are invented and no new key is minted
    expect(after.key).toBe(before.key);
    expect(after.refreshToken).toBeUndefined();
    expect(after.generation).toBe(before.generation);
    expect(after.lastFailure.status).toBe(401);
    fs.removeSync(path.dirname(filePath));
  });

  test('401 and 403 are terminal, 429 and 500 are not', () => {
    expect(isTerminalAuthFailure(401)).toBe(true);
    expect(isTerminalAuthFailure(403)).toBe(true);
    expect(isTerminalAuthFailure(429)).toBe(false);
    expect(isTerminalAuthFailure(500)).toBe(false);
    expect(isTerminalAuthFailure(undefined)).toBe(false);
  });
});

describe('redaction', () => {
  test('masks secrets by shape and by value', () => {
    expect(redactSecret(KEY_A)).toBe('***' + KEY_A.slice(-4));
    expect(redactSecret('short')).toBe('***');
    expect(redactSecret(null)).toBe('');

    const verifier = 'this-is-a-verifier-with-no-recognisable-shape';
    expect(scrub(`leaked ${verifier} here`, [verifier])).toBe('leaked *** here');
    expect(scrub(`leaked ${KEY_A} here`)).not.toContain(KEY_A);
  });

  test('redactDeep masks secret-named fields and scrubs strings', () => {
    const payload = {
      key: KEY_A,
      code_verifier: 'v',
      nested: { authorization: `Bearer ${KEY_A}`, note: `see ${KEY_A}` },
      list: [KEY_A],
    };
    const out = redactDeep(payload);
    expect(out.key).toBe('***');
    expect(out.code_verifier).toBe('***');
    expect(out.nested.authorization).toBe('***');
    expect(JSON.stringify(out)).not.toContain(KEY_A);
  });

  test('safeError strips secrets from messages and details', () => {
    const error = safeError(`failed with ${KEY_A}`, {
      code: 'x',
      known: [KEY_A],
      details: { key: KEY_A },
    });
    expect(error.message).not.toContain(KEY_A);
    expect(JSON.stringify(error.details)).not.toContain(KEY_A);
    expect(error.code).toBe('x');
  });
});
