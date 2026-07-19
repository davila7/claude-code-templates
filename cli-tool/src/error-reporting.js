/**
 * ErrorReporting - Opt-in crash reporting to Sentry
 *
 * Unlike tracking-service.js (anonymous usage analytics, on by default),
 * this NEVER sends anything unless the user explicitly opts in via
 * CCT_ERROR_REPORTING=true. It always respects the existing opt-out flags
 * (CCT_NO_TRACKING, CCT_NO_ANALYTICS, CI) so opt-out still wins over opt-in.
 *
 * No SDK dependency — sends directly to the Sentry envelope API via fetch(),
 * matching the zero-dependency style used elsewhere in this project
 * (cloudflare-workers/*\/sentry.js, dashboard/src/lib/api/error-tracking.ts).
 */

// Public DSN for the "aitmpl-cli" Sentry project. Sentry DSNs are not
// secrets (they only allow sending events, not reading them) — this is the
// same pattern most public telemetry SDKs use. Override with
// CCT_SENTRY_DSN for local testing against a different project.
const DEFAULT_SENTRY_DSN = 'https://1c1637a93ea6fb81e3edae3d039bdae0@o42738.ingest.us.sentry.io/4511679145312256';
const SENTRY_DSN = process.env.CCT_SENTRY_DSN || DEFAULT_SENTRY_DSN;

/**
 * Whether error reporting is allowed to run at all.
 * Opt-in required (CCT_ERROR_REPORTING=true), and opt-out always wins.
 */
function shouldReportErrors() {
    if (process.env.CCT_ERROR_REPORTING !== 'true') {
        return false;
    }

    if (process.env.CCT_NO_TRACKING === 'true' ||
        process.env.CCT_NO_ANALYTICS === 'true' ||
        process.env.CI === 'true') {
        return false;
    }

    if (!SENTRY_DSN) {
        if (process.env.CCT_DEBUG === 'true') {
            console.debug('📊 CCT_ERROR_REPORTING is set but no DSN is configured; skipping.');
        }
        return false;
    }

    return true;
}

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
 * Report a CLI error to Sentry. Opt-in only — see shouldReportErrors().
 * Never throws; safe to call from any catch block.
 *
 * @param {Error} error
 * @param {object} [context] - e.g. { command: 'install', componentType: 'agent' }
 */
async function captureCliError(error, context = {}) {
    if (!shouldReportErrors()) {
        return;
    }

    try {
        const parsed = parseDsn(SENTRY_DSN);
        if (!parsed) return;

        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        const eventId = require('crypto').randomUUID().replace(/-/g, '');
        const timestamp = new Date().toISOString();

        const event = {
            event_id: eventId,
            timestamp,
            platform: 'node',
            logger: 'cli',
            environment: 'production',
            tags: {
                cli_version: getCliVersion(),
                node_version: process.version,
                platform: process.platform,
                ...context,
            },
            extra: context,
            exception: {
                values: [{
                    type: error instanceof Error ? (error.name || 'Error') : 'Error',
                    value: message,
                    stacktrace: stack
                        ? { frames: [{ filename: 'cli', function: 'anonymous', context_line: stack }] }
                        : undefined,
                }],
            },
        };

        const envelopeHeader = JSON.stringify({ event_id: eventId, sent_at: timestamp });
        const itemHeader = JSON.stringify({ type: 'event' });
        const body = `${envelopeHeader}\n${itemHeader}\n${JSON.stringify(event)}\n`;

        const endpoint = `https://${parsed.host}/api/${parsed.projectId}/envelope/`;
        const authHeader = `Sentry sentry_version=7, sentry_client=aitmpl-cli/1.0, sentry_key=${parsed.publicKey}`;

        if (typeof fetch !== 'function') {
            // Node < 18 without global fetch — skip rather than pull in a dependency.
            if (process.env.CCT_DEBUG === 'true') {
                console.debug('📊 Error reporting requires Node 18+ (global fetch); skipping.');
            }
            return;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        try {
            await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-sentry-envelope',
                    'X-Sentry-Auth': authHeader,
                },
                body,
                signal: controller.signal,
            });
            if (process.env.CCT_DEBUG === 'true') {
                console.debug('📊 Error reported to Sentry:', eventId);
            }
        } finally {
            clearTimeout(timeoutId);
        }
    } catch (reportingError) {
        // Error reporting must never crash the CLI or mask the original error.
        if (process.env.CCT_DEBUG === 'true') {
            console.debug('📊 Error reporting failed (non-critical):', reportingError.message);
        }
    }
}

function getCliVersion() {
    try {
        const path = require('path');
        const fs = require('fs');
        const packagePath = path.join(__dirname, '..', 'package.json');
        const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        return packageData.version || 'unknown';
    } catch {
        return 'unknown';
    }
}

module.exports = { captureCliError, shouldReportErrors };
