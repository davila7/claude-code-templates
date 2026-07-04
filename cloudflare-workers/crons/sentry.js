/**
 * Minimal Sentry error reporter for Cloudflare Workers (no npm dependency).
 *
 * Sends errors directly to the Sentry envelope API via fetch(), matching this
 * project's convention of single-file, zero-dependency Workers.
 *
 * Secret required (wrangler secret put SENTRY_DSN):
 *   SENTRY_DSN — DSN from the "aitmpl-workers" Sentry project
 */

/**
 * Parse a Sentry DSN into the pieces needed to build the envelope endpoint.
 * DSN format: https://<publicKey>@<host>/<projectId>
 */
function parseDsn(dsn) {
  try {
    const url = new URL(dsn);
    return {
      publicKey: url.username,
      host: url.host,
      projectId: url.pathname.replace(/^\//, ''),
    };
  } catch {
    return null;
  }
}

/**
 * Report an error to Sentry. Safe to call even if SENTRY_DSN is not configured
 * (no-op) or if the request to Sentry itself fails (never throws).
 *
 * @param {object} env - Worker env bindings (needs env.SENTRY_DSN)
 * @param {Error|string} error - The error (or message) to report
 * @param {object} [context] - Extra tags/context, e.g. { cron, endpoint, status }
 */
async function reportError(env, error, context = {}) {
  const dsn = env && env.SENTRY_DSN;
  if (!dsn) {
    console.error('[sentry] SENTRY_DSN not configured, skipping report:', error);
    return;
  }

  const parsed = parseDsn(dsn);
  if (!parsed) {
    console.error('[sentry] invalid SENTRY_DSN, skipping report');
    return;
  }

  const message = error instanceof Error ? error.message : String(error);
  const stacktrace = error instanceof Error && error.stack ? error.stack : undefined;
  const eventId = crypto.randomUUID().replace(/-/g, '');
  const timestamp = new Date().toISOString();

  const event = {
    event_id: eventId,
    timestamp,
    platform: 'javascript',
    logger: 'cloudflare-worker',
    environment: 'production',
    tags: { worker: context.worker || 'unknown', ...context.tags },
    extra: context,
    exception: {
      values: [
        {
          type: error instanceof Error ? error.name || 'Error' : 'Error',
          value: message,
          stacktrace: stacktrace ? { frames: [{ filename: 'worker', function: 'anonymous', context_line: stacktrace }] } : undefined,
        },
      ],
    },
  };

  const envelopeHeader = JSON.stringify({ event_id: eventId, sent_at: timestamp });
  const itemHeader = JSON.stringify({ type: 'event' });
  const body = `${envelopeHeader}\n${itemHeader}\n${JSON.stringify(event)}\n`;

  const endpoint = `https://${parsed.host}/api/${parsed.projectId}/envelope/`;
  const authHeader = `Sentry sentry_version=7, sentry_client=aitmpl-worker/1.0, sentry_key=${parsed.publicKey}`;

  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': authHeader,
      },
      body,
    });
  } catch (sendError) {
    // Never let error reporting break the worker itself
    console.error('[sentry] failed to send report:', sendError.message);
  }
}

/**
 * Send a Sentry Cron Monitor check-in.
 * @param {object} env - Worker env bindings (needs env.SENTRY_DSN)
 * @param {string} monitorSlug - Slug configured in Sentry (Crons > Add Monitor)
 * @param {'in_progress'|'ok'|'error'} status
 * @param {string} [checkInId] - Pass the id returned from the 'in_progress' call
 *                               so 'ok'/'error' updates the same check-in.
 * @returns {Promise<string|undefined>} checkInId
 */
async function checkIn(env, monitorSlug, status, checkInId) {
  const dsn = env && env.SENTRY_DSN;
  if (!dsn) return undefined;

  const parsed = parseDsn(dsn);
  if (!parsed) return undefined;

  const id = checkInId || crypto.randomUUID().replace(/-/g, '');
  const timestamp = new Date().toISOString();

  const envelopeHeader = JSON.stringify({ sent_at: timestamp });
  const itemPayload = { check_in_id: id, monitor_slug: monitorSlug, status };
  const itemHeader = JSON.stringify({ type: 'check_in' });
  const body = `${envelopeHeader}\n${itemHeader}\n${JSON.stringify(itemPayload)}\n`;

  const endpoint = `https://${parsed.host}/api/${parsed.projectId}/envelope/`;
  const authHeader = `Sentry sentry_version=7, sentry_client=aitmpl-worker/1.0, sentry_key=${parsed.publicKey}`;

  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': authHeader,
      },
      body,
    });
  } catch (sendError) {
    console.error('[sentry] failed to send check-in:', sendError.message);
  }

  return id;
}

export { reportError, checkIn };
