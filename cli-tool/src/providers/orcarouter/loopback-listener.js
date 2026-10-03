'use strict';

const http = require('http');
const crypto = require('crypto');

const { ERROR_CODES } = require('./constants');
const { safeError } = require('./redact');

/**
 * Flow A listener.
 *
 * Binds 127.0.0.1 with an ephemeral port *before* the browser is opened so the
 * redirect can never arrive at a port nobody is listening on, answers the
 * browser with a page it can read, and closes in every terminal path.
 *
 * The `state` comparison happens before the authorization code is handed to any
 * caller: a request whose state does not match is refused and can never be
 * exchanged.
 */

const CALLBACK_PATH = '/cb';

const CLOSE_PAGE =
  '<!doctype html><html><head><meta charset="utf-8"><title>OrcaRouter</title>' +
  '<style>body{font-family:system-ui,sans-serif;margin:4rem auto;max-width:32rem;' +
  'line-height:1.5}</style></head><body><h1>Connected</h1>' +
  '<p>You can close this tab and return to your terminal.</p></body></html>';

function refusalPage(message) {
  return (
    '<!doctype html><html><head><meta charset="utf-8"><title>OrcaRouter</title>' +
    '<style>body{font-family:system-ui,sans-serif;margin:4rem auto;max-width:32rem;' +
    'line-height:1.5}</style></head><body><h1>Authorization not accepted</h1><p>' +
    message +
    '</p></body></html>'
  );
}

/**
 * @param {{expectedState: string, stateEquals?: Function}} options
 * @returns {Promise<{callbackUrl: string, port: number, result: Promise<object>,
 *                    cancel: Function, close: Function, closed: boolean}>}
 */
function startLoopbackListener(options) {
  const stateEquals = options.stateEquals || ((a, b) => a === b);
  const expectedState = options.expectedState;

  return new Promise((resolveReady, rejectReady) => {
    let settle;
    let fail;
    const result = new Promise((resolve, reject) => {
      settle = resolve;
      fail = reject;
    });
    // The listener is created before anything can consume `result`; attach a
    // no-op catch so an unobserved rejection never crashes the process.
    result.catch(() => {});

    let closed = false;
    let finished = false;

    const server = http.createServer((req, res) => {
      let url;
      try {
        url = new URL(req.url, 'http://127.0.0.1');
      } catch (_) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Bad request');
        return;
      }

      if (url.pathname !== CALLBACK_PATH) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }

      const returnedState = url.searchParams.get('state');
      if (!stateEquals(returnedState, expectedState)) {
        // Refuse before the code is read: an unmatched state means this request
        // did not come from the authorization we started.
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(refusalPage('The authorization response did not match this request.'));
        finish(null, safeError('state mismatch', { code: ERROR_CODES.stateMismatch }));
        return;
      }

      const error = url.searchParams.get('error');
      const code = url.searchParams.get('code');

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(error ? refusalPage(`The authorization was refused (${error}).`) : CLOSE_PAGE);
      finish({ code, error: error || null }, null);
    });

    function finish(payload, error) {
      if (finished) return;
      finished = true;
      // Close synchronously so cancellation and timeout release the port
      // immediately; the response has already been handed to the socket.
      close();
      if (error) fail(error);
      else settle(payload);
    }

    function close() {
      if (closed) return;
      closed = true;
      try {
        server.close();
      } catch (_) {
        /* already closing */
      }
    }

    server.on('error', (error) => {
      if (!closed) {
        closed = true;
        try {
          server.close();
        } catch (_) {
          /* ignore */
        }
      }
      const wrapped = safeError(`Could not start the OrcaRouter callback listener: ${error.message}`, {
        code: ERROR_CODES.network,
      });
      rejectReady(wrapped);
      fail(wrapped);
    });

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolveReady({
        port: address.port,
        callbackUrl: `http://127.0.0.1:${address.port}${CALLBACK_PATH}`,
        result,
        close,
        cancel() {
          finish(null, safeError('OrcaRouter authorization was cancelled.', {
            code: ERROR_CODES.cancelled,
          }));
        },
        get closed() {
          return closed;
        },
      });
    });
  });
}

/**
 * Tracks one interactive connect attempt. The attempt id increases
 * monotonically; a late result from an older attempt is refused so it can never
 * overwrite credentials obtained by a newer one.
 */
class ConnectSession {
  constructor() {
    this.attempt = 0;
    this.activeAttempt = null;
    this.listener = null;
  }

  begin() {
    this.attempt += 1;
    this.activeAttempt = { id: this.attempt, signal: new AbortController() };
    return this.activeAttempt.id;
  }

  /** True when `attemptId` is still the current attempt. */
  isCurrent(attemptId) {
    return !!this.activeAttempt && this.activeAttempt.id === attemptId;
  }

  /** Cancel the in-flight attempt and release the listener, if any. */
  cancel(reason) {
    if (this.listener) {
      try {
        this.listener.cancel();
      } catch (_) {
        /* ignore */
      }
      this.listener = null;
    }
    if (this.activeAttempt) {
      this.activeAttempt.signal.abort(reason || 'cancelled');
      this.activeAttempt = null;
    }
    return true;
  }

  /** Release local resources without reporting an error. */
  release() {
    if (this.listener) {
      try {
        this.listener.close();
      } catch (_) {
        /* ignore */
      }
      this.listener = null;
    }
    this.activeAttempt = null;
    return true;
  }
}

function newAttemptToken() {
  return crypto.randomBytes(8).toString('hex');
}

module.exports = {
  CALLBACK_PATH,
  startLoopbackListener,
  ConnectSession,
  newAttemptToken,
};
