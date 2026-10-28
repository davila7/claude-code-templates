'use strict';

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const { KEY_PREFIX, ERROR_CODES } = require('./constants');
const { redactSecret, safeError } = require('./redact');

/**
 * Durable storage for OrcaRouter credentials.
 *
 * Both authentication adapters (a pasted API key and the OAuth 2.0 + PKCE
 * connect flow) end here: they produce the same ordinary `sk-orca-…` key and
 * the same record shape. Nothing downstream — the provider adapter, the model
 * catalog, the inference call sites — knows or cares which adapter produced a
 * credential.
 *
 * The file lives next to Claude Code's own user config (`~/.claude/`), which is
 * already the trust boundary for `ANTHROPIC_AUTH_TOKEN` in `settings.json`, so
 * this does not introduce a second credential store. It is written with mode
 * 0600 and never logged.
 */

const DEFAULT_STORE_PATH = path.join(os.homedir(), '.claude', 'orcarouter', 'credentials.json');

const AUTH_METHODS = {
  apiKey: 'api_key',
  pkce: 'pkce',
};

function nowIso() {
  return new Date().toISOString();
}

function newGeneration() {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * Structural validation of a key. Only format is checked — an `sk-orca-` prefix
 * is not proof that a credential is valid, so validity is reported as unknown
 * until a real request establishes it.
 *
 * @param {unknown} value
 * @returns {{ok: boolean, reason?: string}}
 */
function validateApiKeyShape(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return { ok: false, reason: 'empty' };
  }
  const key = value.trim();
  if (!key.startsWith(KEY_PREFIX)) {
    return { ok: false, reason: `must start with ${KEY_PREFIX}` };
  }
  if (key.length < KEY_PREFIX.length + 16) {
    return { ok: false, reason: 'too short' };
  }
  if (/\s/.test(key)) {
    return { ok: false, reason: 'contains whitespace' };
  }
  return { ok: true };
}

function isTerminalAuthFailure(status) {
  return status === 401 || status === 403;
}

class CredentialStore {
  /**
   * @param {{filePath?: string, env?: NodeJS.ProcessEnv}} [options]
   */
  constructor(options = {}) {
    this.filePath = options.filePath || DEFAULT_STORE_PATH;
    this.env = options.env || process.env;
  }

  load() {
    try {
      if (!fs.existsSync(this.filePath)) return this._empty();
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return this._empty();
      return {
        version: 1,
        credential: parsed.credential || null,
      };
    } catch (_) {
      // A corrupt store must not crash the CLI; it is reported as absent so the
      // user can re-authenticate. The old file is left on disk until a
      // successful login replaces it.
      return this._empty();
    }
  }

  _empty() {
    return { version: 1, credential: null };
  }

  _save(store) {
    fs.ensureDirSync(path.dirname(this.filePath));
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(tmp, this.filePath);
    try {
      fs.chmodSync(this.filePath, 0o600);
    } catch (_) {
      /* best effort on filesystems without POSIX modes */
    }
    return store;
  }

  /**
   * Persist a credential produced by either adapter.
   *
   * @param {{key: string, method: string, scope?: string, userId?: string,
   *          account?: string, acquiredAt?: string}} input
   */
  save(input) {
    const shape = validateApiKeyShape(input && input.key);
    if (!shape.ok) {
      throw safeError(`Refusing to store an invalid OrcaRouter key (${shape.reason})`, {
        code: ERROR_CODES.invalidKey,
        known: [input && input.key],
      });
    }
    if (input.method !== AUTH_METHODS.apiKey && input.method !== AUTH_METHODS.pkce) {
      throw safeError(`Unknown credential method: ${input.method}`, {
        code: ERROR_CODES.invalidKey,
      });
    }

    const previous = this.load().credential;
    const credential = {
      key: String(input.key).trim(),
      method: input.method,
      scope: input.scope || 'api',
      userId: input.userId || null,
      account: input.account || input.userId || 'default',
      acquiredAt: input.acquiredAt || nowIso(),
      needsReauth: false,
      // Bumped on every successful save so a late 401 from an older request can
      // be attributed to the exact generation that made it.
      generation: newGeneration(),
      previousGeneration: previous ? previous.generation : null,
    };
    this._save({ version: 1, credential });
    return credential;
  }

  /**
   * Read the active credential without mutating it. An environment variable
   * always wins, so CI and scripted use never need the store.
   */
  get() {
    const fromEnv = this._fromEnv();
    if (fromEnv) return fromEnv;
    const store = this.load();
    return store.credential;
  }

  _fromEnv() {
    const envKey = this.env.ORCAROUTER_API_KEY;
    if (!envKey || !String(envKey).trim()) return null;
    const key = String(envKey).trim();
    const shape = validateApiKeyShape(key);
    if (!shape.ok) {
      throw safeError(`ORCAROUTER_API_KEY is set but malformed (${shape.reason})`, {
        code: ERROR_CODES.invalidKey,
      });
    }
    return {
      key,
      method: AUTH_METHODS.apiKey,
      scope: 'api',
      userId: null,
      account: 'env:ORCAROUTER_API_KEY',
      acquiredAt: null,
      needsReauth: false,
      generation: 'env',
      source: 'env',
    };
  }

  hasCredential() {
    try {
      return !!this.get();
    } catch (_) {
      return false;
    }
  }

  /** Remove the stored credential. Returns true when something was removed. */
  clear() {
    if (!fs.existsSync(this.filePath)) return false;
    fs.removeSync(this.filePath);
    return true;
  }

  /**
   * Terminal reauthentication. Marks only the credential whose generation made
   * the rejected request; a newer login is never touched by an older failure.
   *
   * @param {{status?: number, generation?: string}} [context]
   */
  markNeedsReauth(context = {}) {
    const store = this.load();
    const credential = store.credential;
    if (!credential) return null;
    if (context.generation && credential.generation !== context.generation) {
      return { changed: false, generation: credential.generation };
    }
    credential.needsReauth = true;
    credential.lastFailure = {
      status: context.status || null,
      at: nowIso(),
      code: isTerminalAuthFailure(context.status)
        ? ERROR_CODES.needsReauth
        : ERROR_CODES.network,
    };
    this._save(store);
    return { changed: true, generation: credential.generation };
  }

  /** Redacted snapshot safe for logs, status output, and tests. */
  describe() {
    let credential;
    try {
      credential = this.get();
    } catch (error) {
      return { configured: false, error: error.message };
    }
    if (!credential) return { configured: false };
    return {
      configured: true,
      provider: 'orcarouter',
      method: credential.method,
      account: credential.account,
      scope: credential.scope,
      generation: credential.generation,
      acquiredAt: credential.acquiredAt,
      needsReauth: !!credential.needsReauth,
      source: credential.source || 'store',
      maskedKey: redactSecret(credential.key),
    };
  }
}

module.exports = {
  CredentialStore,
  DEFAULT_STORE_PATH,
  AUTH_METHODS,
  validateApiKeyShape,
  isTerminalAuthFailure,
};
