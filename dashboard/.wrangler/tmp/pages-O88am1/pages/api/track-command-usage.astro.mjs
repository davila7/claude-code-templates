globalThis.process ??= {}; globalThis.process.env ??= {};
import { c as corsResponse, j as jsonResponse } from '../../chunks/cors_BtEn6YS3.mjs';
import { g as getNeonClient } from '../../chunks/neon_CxLPHwrs.mjs';
import { c as captureApiError } from '../../chunks/error-tracking_CdDsXTS0.mjs';
import { v as validateCommandData } from '../../chunks/usage-tracking_B9LMa2Es.mjs';
export { r as renderers } from '../../chunks/_@astro-renderers_BvXjVE0w.mjs';

const POST = async ({ request }) => {
  try {
    const {
      command,
      cliVersion,
      nodeVersion,
      platform,
      arch,
      sessionId,
      metadata
    } = await request.json();
    const validation = validateCommandData({ command });
    if (!validation.valid) {
      return jsonResponse({ error: validation.error }, 400);
    }
    const sql = getNeonClient();
    await sql`
      INSERT INTO command_usage_logs (
        command_name,
        cli_version,
        node_version,
        platform,
        arch,
        session_id,
        metadata
      ) VALUES (
        ${command},
        ${cliVersion || "unknown"},
        ${nodeVersion || "unknown"},
        ${platform || "unknown"},
        ${arch || "unknown"},
        ${sessionId || null},
        ${metadata ? JSON.stringify(metadata) : null}
      )
    `;
    return jsonResponse({
      success: true,
      message: "Command execution tracked successfully",
      data: { command, timestamp: (/* @__PURE__ */ new Date()).toISOString() }
    });
  } catch (error) {
    console.error("Command tracking error:", error);
    await captureApiError(error, { route: "/api/track-command-usage" });
    return jsonResponse(
      {
        error: "Internal server error",
        message: "Failed to track command execution"
      },
      500
    );
  }
};
const OPTIONS = async () => corsResponse();

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  OPTIONS,
  POST
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
