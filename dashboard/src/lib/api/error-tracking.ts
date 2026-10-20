/**
 * Minimal Sentry error reporter for dashboard API routes.
 *
 * Sends errors directly to the Sentry envelope API via fetch() — no SDK
 * dependency, works the same on Cloudflare Pages' Workers runtime as it
 * does locally. Mirrors the pattern used in cloudflare-workers/{worker}/sentry.js.
 *
 * Env var required: SENTRY_DSN (DSN from the "aitmpl-dashboard" Sentry project)
 */

interface ParsedDsn {
  publicKey: string;
  host: string;
  projectId: string;
}

function parseDsn(dsn: string): ParsedDsn | null {
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

function getDsn(): string | undefined {
  // Astro exposes server env both via import.meta.env and process.env
  // depending on adapter/runtime — check both.
  return (import.meta.env.SENTRY_DSN as string | undefined) || process.env.SENTRY_DSN;
}

/**
 * Report an error from an API route to Sentry. Safe to call unconditionally:
 * no-ops if SENTRY_DSN isn't configured, and never throws.
 *
 * @param error - The error (or message) to report
 * @param context - Extra tags/context, e.g. { route: '/api/health-check' }
 */
export async function captureApiError(
  error: unknown,
  context: Record<string, unknown> = {}
): Promise<void> {
  const dsn = getDsn();
  if (!dsn) {
    console.error('[error-tracking] SENTRY_DSN not configured, skipping report:', error);
    return;
  }

  const parsed = parseDsn(dsn);
  if (!parsed) {
    console.error('[error-tracking] invalid SENTRY_DSN, skipping report');
    return;
  }

  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  const eventId = crypto.randomUUID().replace(/-/g, '');
  const timestamp = new Date().toISOString();

  const event = {
    event_id: eventId,
    timestamp,
    platform: 'javascript',
    logger: 'dashboard-api',
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    tags: { route: context.route || 'unknown' },
    extra: context,
    exception: {
      values: [
        {
          type: error instanceof Error ? error.name || 'Error' : 'Error',
          value: message,
          stacktrace: stack
            ? { frames: [{ filename: 'dashboard-api', function: 'anonymous', context_line: stack }] }
            : undefined,
        },
      ],
    },
  };

  const envelopeHeader = JSON.stringify({ event_id: eventId, sent_at: timestamp });
  const itemHeader = JSON.stringify({ type: 'event' });
  const body = `${envelopeHeader}\n${itemHeader}\n${JSON.stringify(event)}\n`;

  const endpoint = `https://${parsed.host}/api/${parsed.projectId}/envelope/`;
  const authHeader = `Sentry sentry_version=7, sentry_client=aitmpl-dashboard/1.0, sentry_key=${parsed.publicKey}`;

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
    // Never let error reporting break the API route itself
    console.error('[error-tracking] failed to send report:', (sendError as Error).message);
  }
}
