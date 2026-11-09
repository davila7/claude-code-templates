globalThis.process ??= {}; globalThis.process.env ??= {};
import { c as corsResponse, j as jsonResponse } from '../../chunks/cors_BtEn6YS3.mjs';
import { g as getNeonClient } from '../../chunks/neon_CxLPHwrs.mjs';
import { c as captureApiError } from '../../chunks/error-tracking_CdDsXTS0.mjs';
import { a as validateOutcomeData } from '../../chunks/usage-tracking_B9LMa2Es.mjs';
export { r as renderers } from '../../chunks/_@astro-renderers_BvXjVE0w.mjs';

const POST = async ({ request }) => {
  try {
    const {
      componentType,
      componentName,
      outcome,
      errorType,
      errorMessage,
      durationMs,
      cliVersion,
      nodeVersion,
      platform,
      arch,
      batchId
    } = await request.json();
    const validation = validateOutcomeData({ componentType, componentName, outcome });
    if (!validation.valid) {
      return jsonResponse({ error: validation.error }, 400);
    }
    const sql = getNeonClient();
    await sql`
      INSERT INTO installation_outcomes (
        component_type, component_name, outcome,
        error_type, error_message, duration_ms,
        cli_version, node_version, platform, arch, batch_id
      ) VALUES (
        ${componentType},
        ${componentName},
        ${outcome},
        ${errorType || null},
        ${errorMessage ? errorMessage.substring(0, 1e3) : null},
        ${durationMs || null},
        ${cliVersion || "unknown"},
        ${nodeVersion || "unknown"},
        ${platform || "unknown"},
        ${arch || "unknown"},
        ${batchId || null}
      )
    `;
    return jsonResponse({
      success: true,
      message: "Installation outcome tracked",
      data: { componentType, componentName, outcome, timestamp: (/* @__PURE__ */ new Date()).toISOString() }
    });
  } catch (error) {
    console.error("Installation outcome tracking error:", error);
    await captureApiError(error, { route: "/api/track-installation-outcome" });
    return jsonResponse(
      {
        error: "Internal server error",
        message: "Failed to track installation outcome"
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
