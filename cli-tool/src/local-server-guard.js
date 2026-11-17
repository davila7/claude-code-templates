/**
 * Guards for the local dashboards (--analytics, --chats).
 *
 * They serve the user's conversation history, so they listen on 127.0.0.1 only
 * and answer only requests addressed to localhost by a page they served:
 * - Host must be a loopback name with the dashboard's port. A browser that
 *   followed a DNS-rebinding domain to 127.0.0.1 sends that domain as Host.
 * - Origin, when present, must be the dashboard itself. Browsers send it on
 *   cross-site fetches and form posts and on every WebSocket handshake; curl
 *   and other local tools send none and are allowed.
 */

const LISTEN_HOST = '127.0.0.1';
const LOOPBACK_NAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

function splitHostHeader(host) {
  if (typeof host !== 'string' || host.length === 0) return null;
  const match = host.toLowerCase().match(/^(\[[^\]]+\]|[^:]+)(?::(\d+))?$/);
  if (!match) return null;
  return { name: match[1], port: match[2] };
}

function isAllowedHost(hostHeader, port) {
  const parsed = splitHostHeader(hostHeader);
  if (!parsed || !LOOPBACK_NAMES.has(parsed.name)) return false;
  return parsed.port === String(port);
}

function isAllowedOrigin(origin, port) {
  if (origin === undefined || origin === null || origin === '') return true;
  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  return url.protocol === 'http:' && LOOPBACK_NAMES.has(url.hostname) && url.port === String(port);
}

/** Express middleware that rejects requests not addressed to the local dashboard. */
function localOnly(port) {
  return (req, res, next) => {
    if (!isAllowedHost(req.headers.host, port) || !isAllowedOrigin(req.headers.origin, port)) {
      res.status(403).type('text/plain').send('Forbidden: this dashboard only answers on http://localhost:' + port);
      return;
    }
    next();
  };
}

/** `verifyClient` for a ws server attached to the dashboard's HTTP server. */
function verifyLocalWebSocket(port) {
  return (info) => isAllowedHost(info.req.headers.host, port) && isAllowedOrigin(info.origin, port);
}

module.exports = {
  LISTEN_HOST,
  isAllowedHost,
  isAllowedOrigin,
  localOnly,
  verifyLocalWebSocket
};
