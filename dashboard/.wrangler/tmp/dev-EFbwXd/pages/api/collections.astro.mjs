globalThis.process ??= {}; globalThis.process.env ??= {};
import { j as jsonResponse, c as corsResponse } from '../../chunks/cors_BtEn6YS3.mjs';
import { a as authenticateRequest } from '../../chunks/auth_DY7lpPdY.mjs';
import { g as getNeonClient } from '../../chunks/neon_CxLPHwrs.mjs';
export { r as renderers } from '../../chunks/_@astro-renderers_BvXjVE0w.mjs';

const OPTIONS = async () => corsResponse();
const GET = async ({ request }) => {
  const userId = await authenticateRequest(request);
  if (!userId) return jsonResponse({ error: "Missing or invalid Authorization header" }, 401);
  const sql = getNeonClient();
  try {
    const collections = await sql`
      SELECT * FROM user_collections
      WHERE clerk_user_id = ${userId}
      ORDER BY position ASC, created_at ASC
    `;
    const items = collections.length > 0 ? await sql`
          SELECT * FROM collection_items
          WHERE collection_id = ANY(${collections.map((c) => c.id)})
          ORDER BY added_at ASC
        ` : [];
    const itemsByCollection = {};
    for (const item of items) {
      if (!itemsByCollection[item.collection_id]) {
        itemsByCollection[item.collection_id] = [];
      }
      itemsByCollection[item.collection_id].push(item);
    }
    const result = collections.map((c) => ({
      ...c,
      collection_items: itemsByCollection[c.id] || []
    }));
    return jsonResponse({ collections: result });
  } catch (error) {
    console.error("Collections error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
};
const POST = async ({ request }) => {
  const userId = await authenticateRequest(request);
  if (!userId) return jsonResponse({ error: "Missing or invalid Authorization header" }, 401);
  const sql = getNeonClient();
  try {
    const { name } = await request.json();
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return jsonResponse({ error: "Collection name is required" }, 400);
    }
    if (name.length > 100) {
      return jsonResponse({ error: "Collection name too long (max 100 characters)" }, 400);
    }
    const maxPos = await sql`
      SELECT COALESCE(MAX(position), -1) AS max_pos
      FROM user_collections
      WHERE clerk_user_id = ${userId}
    `;
    const newPosition = maxPos[0].max_pos + 1;
    const rows = await sql`
      INSERT INTO user_collections (clerk_user_id, name, position)
      VALUES (${userId}, ${name.trim()}, ${newPosition})
      RETURNING *
    `;
    const collection = { ...rows[0], collection_items: [] };
    return jsonResponse({ collection }, 201);
  } catch (error) {
    console.error("Collections error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET,
  OPTIONS,
  POST
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
