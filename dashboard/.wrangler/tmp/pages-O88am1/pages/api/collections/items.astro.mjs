globalThis.process ??= {}; globalThis.process.env ??= {};
import { j as jsonResponse, c as corsResponse } from '../../../chunks/cors_BtEn6YS3.mjs';
import { a as authenticateRequest } from '../../../chunks/auth_DY7lpPdY.mjs';
import { g as getNeonClient } from '../../../chunks/neon_CxLPHwrs.mjs';
export { r as renderers } from '../../../chunks/_@astro-renderers_BvXjVE0w.mjs';

const OPTIONS = async () => corsResponse();
const POST = async ({ request }) => {
  const userId = await authenticateRequest(request);
  if (!userId) return jsonResponse({ error: "Missing or invalid Authorization header" }, 401);
  const sql = getNeonClient();
  try {
    const { collectionId, componentType, componentPath, componentName, componentCategory } = await request.json();
    if (!collectionId || !componentType || !componentPath || !componentName) {
      return jsonResponse({ error: "collectionId, componentType, componentPath, and componentName are required" }, 400);
    }
    const col = await sql`
      SELECT id FROM user_collections
      WHERE id = ${collectionId} AND clerk_user_id = ${userId}
    `;
    if (col.length === 0) {
      return jsonResponse({ error: "Collection not found" }, 404);
    }
    const dup = await sql`
      SELECT id FROM collection_items
      WHERE collection_id = ${collectionId} AND component_path = ${componentPath}
    `;
    if (dup.length > 0) {
      return jsonResponse({ error: "Component already in this collection" }, 409);
    }
    const rows = await sql`
      INSERT INTO collection_items (collection_id, component_type, component_path, component_name, component_category)
      VALUES (${collectionId}, ${componentType}, ${componentPath}, ${componentName}, ${componentCategory || null})
      RETURNING *
    `;
    return jsonResponse({ item: rows[0] }, 201);
  } catch (error) {
    console.error("Collection items error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
};
const DELETE = async ({ request }) => {
  const userId = await authenticateRequest(request);
  if (!userId) return jsonResponse({ error: "Missing or invalid Authorization header" }, 401);
  const sql = getNeonClient();
  try {
    const { itemId, collectionId } = await request.json();
    if (!itemId || !collectionId) {
      return jsonResponse({ error: "itemId and collectionId are required" }, 400);
    }
    const col = await sql`
      SELECT id FROM user_collections
      WHERE id = ${collectionId} AND clerk_user_id = ${userId}
    `;
    if (col.length === 0) {
      return jsonResponse({ error: "Collection not found" }, 404);
    }
    await sql`
      DELETE FROM collection_items
      WHERE id = ${itemId} AND collection_id = ${collectionId}
    `;
    return jsonResponse({ success: true });
  } catch (error) {
    console.error("Collection items error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
};
const PATCH = async ({ request }) => {
  const userId = await authenticateRequest(request);
  if (!userId) return jsonResponse({ error: "Missing or invalid Authorization header" }, 401);
  const sql = getNeonClient();
  try {
    const { itemId, fromCollectionId, toCollectionId } = await request.json();
    if (!itemId || !fromCollectionId || !toCollectionId) {
      return jsonResponse({ error: "itemId, fromCollectionId, and toCollectionId are required" }, 400);
    }
    const cols = await sql`
      SELECT id FROM user_collections
      WHERE id = ANY(${[fromCollectionId, toCollectionId]}) AND clerk_user_id = ${userId}
    `;
    if (cols.length < 2) {
      return jsonResponse({ error: "One or both collections not found" }, 404);
    }
    const rows = await sql`
      UPDATE collection_items
      SET collection_id = ${toCollectionId}
      WHERE id = ${itemId} AND collection_id = ${fromCollectionId}
      RETURNING *
    `;
    if (rows.length === 0) {
      return jsonResponse({ error: "Item not found in source collection" }, 404);
    }
    return jsonResponse({ item: rows[0] });
  } catch (error) {
    console.error("Collection items error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  DELETE,
  OPTIONS,
  PATCH,
  POST
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
