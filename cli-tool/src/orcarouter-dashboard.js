'use strict';

const express = require('express');
const chalk = require('chalk');
const open = require('open');
const path = require('path');
const crypto = require('crypto');

const provider = require('./providers/orcarouter');
const { CredentialStore, AUTH_METHODS } = require('./providers/orcarouter/credential-store');
const { redactSecret, scrub } = require('./providers/orcarouter/redact');
const {
  ERROR_CODES,
  CONSOLE_KEYS_URL,
  CONSOLE_AUTHORIZED_APPS_URL,
} = require('./providers/orcarouter/constants');
const {
  buildAuthorizeUrl,
  createPkcePair,
  exchangeCodeForKey,
} = require('./providers/orcarouter/pkce');
const { startLoopbackListener } = require('./providers/orcarouter/loopback-listener');
const { validateApiKeyShape } = require('./providers/orcarouter/credential-store');

/**
 * OrcaRouter provider dashboard — a local, browser-served surface for the two
 * authentication choices and the capability-filtered model selector.
 *
 * Follows the existing local-dashboard pattern (`plugin-dashboard.js`,
 * `skill-dashboard.js`): an Express app on a fixed port that owns the secret
 * server-side.
 *
 * The API key never reaches the browser. The server holds it, performs model
 * discovery with it, and returns only the minimal model metadata the selector
 * needs (id, label, context window, declared input modalities, verification
 * flag). Credential mutations happen only through these routes.
 *
 * Login lock lifecycle: a single in-flight attempt is tracked with a
 * monotonically increasing attempt id. Every async completion re-checks that id
 * before touching credentials or state, and every terminal path — success,
 * denial, exchange error, timeout, explicit cancel, switching authentication
 * method, and `pagehide` — releases both the server listener and the client's
 * busy state. `pagehide` is handled by clearing the UI synchronously and then
 * sending the cancellation with `keepalive`, because a generation guard would
 * otherwise suppress the cleanup on a back-forward-cache restore.
 */

const DEFAULT_PORT = 3339;

/**
 * Tracks the single in-flight interactive login.
 *
 * The attempt id is monotonic; it never repeats or goes backwards, so a late
 * response from an abandoned attempt can be recognised and dropped.
 */
class LoginManager {
  constructor() {
    this.generation = 0;
    this.active = null;
  }

  /**
   * @param {{flow: string, store: object, env: object, authEndpoint: string,
   *          timeoutMs?: number}} input
   */
  async begin(input) {
    // Starting a new attempt abandons any previous one: the old listener is
    // released so the port cannot stay bound and the lock cannot stick.
    this.cancel(this.active ? this.active.id : null, 'superseded');
    this.abandoned = this.abandoned || new Map();

    this.generation += 1;
    const attempt = {
      id: this.generation,
      flow: input.flow,
      status: 'pending',
      createdAt: Date.now(),
      authorizeUrl: null,
      error: null,
      code: null,
      listener: null,
      verifier: null,
      state: null,
      account: null,
    };
    this.active = attempt;

    const pkce = createPkcePair();
    attempt.verifier = pkce.verifier;
    attempt.state = pkce.state;

    if (input.flow === 'oob') {
      attempt.authorizeUrl = buildAuthorizeUrl(
        {
          callbackUrl: 'oob',
          codeChallenge: pkce.challenge,
          state: pkce.state,
          appName: 'Claude Code Templates Dashboard',
        },
        input.authEndpoint
      );
      return attempt;
    }

    const listener = await startLoopbackListener({
      expectedState: pkce.state,
      stateEquals: require('./providers/orcarouter/pkce').safeEqual,
    });
    if (!this.isCurrent(attempt.id)) {
      // Superseded while the listener was binding.
      listener.close();
      return attempt;
    }
    attempt.listener = listener;
    attempt.authorizeUrl = buildAuthorizeUrl(
      {
        callbackUrl: listener.callbackUrl,
        codeChallenge: pkce.challenge,
        state: pkce.state,
        appName: 'Claude Code Templates Dashboard',
      },
      input.authEndpoint
    );

    listener.result
      .then((payload) => this._complete(attempt.id, payload, input))
      .catch((error) => this._fail(attempt.id, error));

    return attempt;
  }

  /** Redeem a code the user pasted (Flow B) or that the redirect delivered. */
  async _complete(attemptId, payload, input) {
    if (!this.isCurrent(attemptId)) return; // stale attempt: drop the result
    const attempt = this.active;

    if (payload.error) {
      attempt.status = 'error';
      attempt.code = payload.error === 'access_denied' ? ERROR_CODES.denied : ERROR_CODES.network;
      attempt.error =
        payload.error === 'access_denied'
          ? 'Authorization was denied in the browser. No credential was stored.'
          : `Authorization failed: ${payload.error}`;
      this._release(attempt);
      return;
    }
    if (!payload.code) {
      attempt.status = 'error';
      attempt.code = ERROR_CODES.codeRejected;
      attempt.error = 'The authorization redirect carried no code.';
      this._release(attempt);
      return;
    }
    await this._exchange(attemptId, payload.code, input);
  }

  async _exchange(attemptId, code, input) {
    if (!this.isCurrent(attemptId)) return;
    const attempt = this.active;
    try {
      const result = await exchangeCodeForKey({
        code,
        verifier: attempt.verifier,
        authEndpoint: input.authEndpoint,
        requestedScope: 'api',
      });
      if (!this.isCurrent(attemptId)) return; // a newer attempt already won
      const record = input.store.save({
        key: result.key,
        method: AUTH_METHODS.pkce,
        scope: result.scope,
        userId: result.userId,
        account: result.userId ? `user:${result.userId}` : 'pkce',
      });
      attempt.status = 'connected';
      attempt.account = record.account;
      attempt.scope = record.scope;
      attempt.maskedKey = redactSecret(record.key);
      attempt.scopeWarning = result.downgraded
        ? `Granted scope "${result.scope}" instead of "api".`
        : null;
    } catch (error) {
      attempt.status = 'error';
      attempt.code = error.code || ERROR_CODES.network;
      attempt.error = scrub(error.message, [attempt.verifier]);
    } finally {
      this._release(attempt);
    }
  }

  _fail(attemptId, error) {
    if (!this.isCurrent(attemptId)) return;
    const attempt = this.active;
    attempt.status = 'error';
    attempt.code = error.code || ERROR_CODES.network;
    attempt.error = scrub(error.message, [attempt.verifier]);
    this._release(attempt);
  }

  /** Release the listener but keep the attempt record readable by the client. */
  _release(attempt) {
    if (attempt && attempt.listener) {
      try {
        attempt.listener.close();
      } catch (_) {
        /* already closed */
      }
      attempt.listener = null;
    }
  }

  isCurrent(attemptId) {
    return !!this.active && this.active.id === attemptId && this.active.status === 'pending';
  }

  /**
   * Cancel an attempt. Returns false when the id is not the current attempt,
   * which is how a stale browser tab is prevented from cancelling a newer login.
   */
  cancel(attemptId, reason) {
    if (!attemptId) return false;
    if (!this.active || this.active.id !== attemptId) return false;
    const attempt = this.active;
    if (attempt.listener) {
      try {
        attempt.listener.cancel();
      } catch (_) {
        /* ignore */
      }
    }
    this._release(attempt);
    if (attempt.status === 'pending') {
      attempt.status = 'cancelled';
      attempt.code = ERROR_CODES.cancelled;
      attempt.error = reason === 'superseded'
        ? 'A newer authorization attempt replaced this one.'
        : 'Authorization was cancelled.';
    }
    // Keep the last few terminal attempts addressable so a browser tab that
    // polls after a cancel or supersede still gets a definitive answer.
    this.abandoned = this.abandoned || new Map();
    this.abandoned.set(attempt.id, {
      status: attempt.status,
      error: attempt.error,
      code: attempt.code,
    });
    while (this.abandoned.size > 10) {
      this.abandoned.delete(this.abandoned.keys().next().value);
    }
    return true;
  }

  /** Live state for the polling client; the verifier is never serialised. */
  describe(attemptId) {
    const wanted = attemptId ? Number(attemptId) : null;
    if (this.active && (!wanted || this.active.id === wanted)) {
      const attempt = this.active;
      return {
        attemptId: attempt.id,
        generation: attempt.id,
        flow: attempt.flow,
        status: attempt.status,
        error: attempt.error,
        code: attempt.code,
        account: attempt.account || null,
        scope: attempt.scope || null,
        maskedKey: attempt.maskedKey || null,
        scopeWarning: attempt.scopeWarning || null,
        authorizeUrl:
          attempt.status === 'pending' || attempt.status === 'connected' ? attempt.authorizeUrl : null,
      };
    }
    // A browser tab that outlived its attempt still needs a truthful answer.
    const abandoned = this.abandoned && wanted ? this.abandoned.get(wanted) : null;
    if (abandoned) {
      return { attemptId: wanted, status: abandoned.status, error: abandoned.error, code: abandoned.code };
    }
    return { attemptId: wanted, status: wanted ? 'stale' : 'idle', generation: this.generation };
  }
}

/**
 * Minimal model metadata for the browser. Deliberately excludes pricing,
 * provider credentials, and anything else the selector does not need.
 */
function toBrowserModel(option) {
  return {
    id: option.id,
    label: option.label,
    context_length: option.context_length,
    input_modalities: option.input_modalities,
    reasoning_efforts: option.reasoning_efforts,
    verified: !!option.verified,
  };
}

class OrcaRouterDashboard {
  constructor(options = {}) {
    this.options = options;
    this.port = options.port || DEFAULT_PORT;
    this.env = options.env || process.env;
    this.store =
      options.store ||
      new CredentialStore({ filePath: options.credentialFile, env: this.env });
    this.login = new LoginManager();
    this.app = express();
    this.httpServer = null;
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(express.json({ limit: '32kb' }));
    // The dashboard is a local tool; only the served origin may call it.
    this.app.use((req, res, next) => {
      const origin = req.headers.origin;
      if (origin && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        res.status(403).json({ error: 'origin not allowed' });
        return;
      }
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'no-referrer');
      next();
    });
  }

  setupRoutes() {
    const webDir = path.join(__dirname, 'orcarouter-dashboard-web');
    this.app.use(express.static(webDir, { index: false }));

    this.app.get('/', (req, res) => {
      res.sendFile(path.join(webDir, 'index.html'));
    });

    // Provider + both authentication methods, with the credential masked.
    this.app.get('/api/provider', (req, res) => {
      const status = provider.getStatus({ store: this.store, env: this.env });
      const login = this.login.describe(req.query.attemptId);
      res.json({
        provider: status.provider,
        name: status.name,
        apiBaseUrl: status.apiBaseUrl,
        anthropicBaseUrl: status.anthropicBaseUrl,
        authBaseUrl: status.authBaseUrl,
        consoleKeysUrl: status.consoleKeysUrl,
        authorizedAppsUrl: CONSOLE_AUTHORIZED_APPS_URL,
        sources: status.sources,
        credential: {
          configured: status.credential.configured,
          method: status.credential.method,
          account: status.credential.account,
          scope: status.credential.scope,
          maskedKey: status.credential.maskedKey,
          needsReauth: !!status.credential.needsReauth,
        },
        login: { attemptId: login.attemptId || null, status: login.status || 'idle' },
      });
    });

    // API-key entry: the key is validated, stored server-side, and never echoed.
    this.app.post('/api/credential/api-key', (req, res) => {
      const key = req.body && req.body.key;
      const shape = validateApiKeyShape(key);
      if (!shape.ok) {
        res.status(400).json({
          error: `That does not look like an OrcaRouter API key (${shape.reason}).`,
          code: ERROR_CODES.invalidKey,
        });
        return;
      }
      try {
        const record = this.store.save({
          key: String(key).trim(),
          method: AUTH_METHODS.apiKey,
          scope: 'api',
          account: 'api-key',
        });
        res.json({ ok: true, maskedKey: redactSecret(record.key), method: record.method });
      } catch (error) {
        res.status(400).json({ error: error.message, code: error.code });
      }
    });

    this.app.delete('/api/credential', (req, res) => {
      const removed = this.store.clear();
      res.json({ ok: true, removed });
    });

    // Start a PKCE login.
    this.app.post('/api/credential/connect', async (req, res) => {
      const flow = req.body && req.body.flow === 'oob' ? 'oob' : 'loopback';
      try {
        const attempt = await this.login.begin({
          flow,
          store: this.store,
          env: this.env,
          authEndpoint: require('./providers/orcarouter/constants').authorizeUrl(this.env),
          timeoutMs: this.options.timeoutMs,
        });
        res.json({
          attemptId: attempt.id,
          generation: attempt.id,
          flow: attempt.flow,
          authorizeUrl: attempt.authorizeUrl,
          status: attempt.status,
        });
      } catch (error) {
        res.status(500).json({ error: scrub(error.message), code: error.code });
      }
    });

    // Poll one attempt. A stale attempt id is reported as stale, never applied.
    this.app.get('/api/credential/connect/:attemptId', (req, res) => {
      res.json(this.login.describe(req.params.attemptId));
    });

    // Deliver a pasted out-of-band code for the current attempt.
    this.app.post('/api/credential/connect/:attemptId/code', async (req, res) => {
      const attemptId = Number(req.params.attemptId);
      if (!this.login.isCurrent(attemptId)) {
        res.status(409).json({ error: 'This authorization attempt is no longer current.', code: 'stale' });
        return;
      }
      const code = (req.body && req.body.code ? String(req.body.code) : '').trim();
      if (!code) {
        res.status(400).json({ error: 'No code provided.', code: ERROR_CODES.cancelled });
        return;
      }
      // Answer immediately, then redeem: the browser must not wait on the
      // exchange, and a failure still lands on the attempt record.
      res.json({ ok: true, status: 'exchanging' });
      await this.login._exchange(attemptId, code, {
        store: this.store,
        env: this.env,
        authEndpoint: require('./providers/orcarouter/constants').authorizeUrl(this.env),
      });
    });

    // Release the login lock. Safe to call repeatedly; the browser uses it on
    // pagehide, unmount, explicit cancel, and before switching auth method.
    this.app.post('/api/credential/connect/cancel', (req, res) => {
      const attemptId = req.body && req.body.attemptId ? Number(req.body.attemptId) : null;
      const changed = attemptId ? this.login.cancel(attemptId, 'cancelled') : false;
      res.json({ ok: true, cancelled: changed, status: changed ? 'cancelled' : 'idle' });
    });

    // Capability-filtered model options. The server holds the key.
    this.app.get('/api/models', async (req, res) => {
      const capability = req.query.capability === 'chat' ? 'chat' : String(req.query.capability || 'chat');
      const modalities = String(req.query.modalities || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      try {
        const result = await provider.getModelOptions(
          { capability, extraModalities: modalities },
          { store: this.store, env: this.env }
        );
        res.json({
          capability,
          modalities,
          count: result.count,
          degraded: result.degraded,
          reason: result.reason,
          message: result.message ? scrub(result.message) : null,
          source: result.source,
          catalogUrl: result.catalogUrl,
          models: result.options.map(toBrowserModel),
        });
      } catch (error) {
        res.status(500).json({ error: scrub(error.message), code: error.code });
      }
    });

    // Global error handler so a malformed body cannot take the process down.
    this.app.use((error, req, res, next) => {
      res.status(400).json({ error: scrub(error.message) });
    });
  }

  async startServer() {
    return new Promise((resolve, reject) => {
      const tryPort = (port) => {
        this.httpServer = this.app
          .listen(port, '127.0.0.1', () => {
            this.port = port;
            resolve(this.port);
          })
          .on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
              tryPort(port + 1);
            } else {
              reject(error);
            }
          });
      };
      tryPort(this.port);
    });
  }

  stop() {
    this.login.cancel(this.login.active ? this.login.active.id : null, 'shutdown');
    if (this.httpServer) this.httpServer.close();
  }

  get url() {
    return `http://127.0.0.1:${this.port}`;
  }
}

async function runOrcaRouterDashboard(options = {}) {
  console.log(chalk.blue('🧭 Starting OrcaRouter provider dashboard...'));
  const dashboard = new OrcaRouterDashboard(options);
  const port = await dashboard.startServer();
  const url = `http://127.0.0.1:${port}`;
  console.log(chalk.green(`✅ OrcaRouter dashboard is running at ${url}`));
  console.log(chalk.gray('Press Ctrl+C to stop the server'));

  if (!process.env.CCT_ORCAROUTER_DASHBOARD_NO_OPEN) {
    try {
      await open(url);
    } catch (_) {
      console.log(chalk.gray('Open the URL above in a browser.'));
    }
  }

  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n🛑 Shutting down OrcaRouter dashboard...'));
    dashboard.stop();
    process.exit(0);
  });

  await new Promise(() => {});
}

module.exports = {
  OrcaRouterDashboard,
  runOrcaRouterDashboard,
  LoginManager,
  DEFAULT_PORT,
  newAttemptToken: () => crypto.randomBytes(8).toString('hex'),
};
