globalThis.process ??= {}; globalThis.process.env ??= {};
import { j as jsonResponse, c as corsResponse } from '../../../chunks/cors_BtEn6YS3.mjs';
import { a as authenticateRequest } from '../../../chunks/auth_DY7lpPdY.mjs';
import { g as getNeonClient } from '../../../chunks/neon_CxLPHwrs.mjs';
export { r as renderers } from '../../../chunks/_@astro-renderers_BvXjVE0w.mjs';

const OPTIONS = async () => corsResponse();
const PATCH = async ({ request, params }) => {
  const userId = await authenticateRequest(request);
  if (!userId) return jsonResponse({ error: "Missing or invalid Authorization header" }, 401);
  const { id } = params;
  if (!id) return jsonResponse({ error: "Collection ID is required" }, 400);
  const sql = getNeonClient();
  try {
    const existing = await sql`
      SELECT id FROM user_collections
      WHERE id = ${id} AND clerk_user_id = ${userId}
    `;
    if (existing.length === 0) {
      return jsonResponse({ error: "Collection not found" }, 404);
    }
    const { name } = await request.json();
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return jsonResponse({ error: "Collection name is required" }, 400);
    }
    if (name.length > 100) {
      return jsonResponse({ error: "Collection name too long (max 100 characters)" }, 400);
    }
    const rows = await sql`
      UPDATE user_collections
      SET name = ${name.trim()}, updated_at = NOW()
      WHERE id = ${id} AND clerk_user_id = ${userId}
      RETURNING *
    `;
    const items = await sql`
      SELECT * FROM collection_items
      WHERE collection_id = ${id}
      ORDER BY added_at ASC
    `;
    const collection = { ...rows[0], collection_items: items };
    return jsonResponse({ collection });
  } catch (error) {
    console.error("Collection [id] error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
};
const DELETE = async ({ request, params }) => {
  const userId = await authenticateRequest(request);
  if (!userId) return jsonResponse({ error: "Missing or invalid Authorization header" }, 401);
  const { id } = params;
  if (!id) return jsonResponse({ error: "Collection ID is required" }, 400);
  const sql = getNeonClient();
  try {
    const existing = await sql`
      SELECT id FROM user_collections
      WHERE id = ${id} AND clerk_user_id = ${userId}
    `;
    if (existing.length === 0) {
      return jsonResponse({ error: "Collection not found" }, 404);
    }
    await sql`DELETE FROM collection_items WHERE collection_id = ${id}`;
    await sql`DELETE FROM user_collections WHERE id = ${id} AND clerk_user_id = ${userId}`;
    return jsonResponse({ success: true });
  } catch (error) {
    console.error("Collection [id] error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  DELETE,
  OPTIONS,
  PATCH
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
