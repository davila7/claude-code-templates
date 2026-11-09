globalThis.process ??= {}; globalThis.process.env ??= {};
import { c as corsResponse, j as jsonResponse } from '../../chunks/cors_BtEn6YS3.mjs';
import { g as getNeonClient } from '../../chunks/neon_CxLPHwrs.mjs';
import { g as getCountry } from '../../chunks/geo_DKIoVc_1.mjs';
export { r as renderers } from '../../chunks/_@astro-renderers_BvXjVE0w.mjs';

const VALID_EVENT_TYPES = [
  "search",
  "cart_add",
  "cart_remove",
  "cart_checkout",
  "component_view",
  "copy_command"
];
const MAX_EVENTS_PER_BATCH = 50;
function validateEventsData(data) {
  const { events } = data;
  if (!events || !Array.isArray(events) || events.length === 0) {
    return { valid: false, error: "events array is required and must not be empty" };
  }
  if (events.length > MAX_EVENTS_PER_BATCH) {
    return { valid: false, error: `Maximum ${MAX_EVENTS_PER_BATCH} events per batch` };
  }
  for (const event of events) {
    if (!event.event_type || !VALID_EVENT_TYPES.includes(event.event_type)) {
      return { valid: false, error: `Invalid event_type: ${event.event_type}` };
    }
  }
  return { valid: true, error: null };
}
const POST = async ({ request }) => {
  try {
    const {
      events,
      session_id,
      visitor_id,
      screen_width,
      referrer
    } = await request.json();
    const validation = validateEventsData({ events });
    if (!validation.valid) {
      return jsonResponse({ error: validation.error }, 400);
    }
    const country = getCountry(request);
    const sql = getNeonClient();
    let inserted = 0;
    for (const event of events) {
      await sql`
        INSERT INTO website_events (
          event_type, event_data, page_path,
          referrer, session_id, visitor_id,
          country, screen_width
        ) VALUES (
          ${event.event_type},
          ${event.event_data ? JSON.stringify(event.event_data) : null},
          ${event.page_path || null},
          ${referrer ? referrer.substring(0, 1e3) : null},
          ${session_id || null},
          ${visitor_id || null},
          ${country},
          ${screen_width || null}
        )
      `;
      inserted++;
    }
    return jsonResponse({
      success: true,
      message: `${inserted} events tracked`,
      data: { count: inserted, timestamp: (/* @__PURE__ */ new Date()).toISOString() }
    });
  } catch (error) {
    console.error("Website events tracking error:", error);
    return jsonResponse(
      {
        error: "Internal server error",
        message: "Failed to track website events"
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
