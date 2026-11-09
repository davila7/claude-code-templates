globalThis.process ??= {}; globalThis.process.env ??= {};
function parseDsn(dsn) {
  try {
    const url = new URL(dsn);
    return {
      publicKey: url.username,
      host: url.host,
      projectId: url.pathname.replace(/^\//, "")
    };
  } catch {
    return null;
  }
}
function getDsn() {
  return process.env.SENTRY_DSN;
}
async function captureApiError(error, context = {}, options = {}) {
  const dsn = getDsn();
  if (!dsn) {
    console.error("[error-tracking] SENTRY_DSN not configured, skipping report:", error);
    return;
  }
  const parsed = parseDsn(dsn);
  if (!parsed) {
    console.error("[error-tracking] invalid SENTRY_DSN, skipping report");
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : void 0;
  const eventId = crypto.randomUUID().replace(/-/g, "");
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const event = {
    event_id: eventId,
    timestamp,
    platform: "javascript",
    logger: "dashboard-api",
    level: options.level ?? "error",
    ...options.fingerprint ? { fingerprint: options.fingerprint } : {},
    environment: "production" ,
    tags: { route: context.route || "unknown" },
    extra: context,
    exception: {
      values: [
        {
          type: error instanceof Error ? error.name || "Error" : "Error",
          value: message,
          stacktrace: stack ? { frames: [{ filename: "dashboard-api", function: "anonymous", context_line: stack }] } : void 0
        }
      ]
    }
  };
  const envelopeHeader = JSON.stringify({ event_id: eventId, sent_at: timestamp });
  const itemHeader = JSON.stringify({ type: "event" });
  const body = `${envelopeHeader}
${itemHeader}
${JSON.stringify(event)}
`;
  const endpoint = `https://${parsed.host}/api/${parsed.projectId}/envelope/`;
  const authHeader = `Sentry sentry_version=7, sentry_client=aitmpl-dashboard/1.0, sentry_key=${parsed.publicKey}`;
  try {
    await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": authHeader
      },
      body
    });
  } catch (sendError) {
    console.error("[error-tracking] failed to send report:", sendError.message);
  }
}

export { captureApiError as c };
