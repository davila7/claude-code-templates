globalThis.process ??= {}; globalThis.process.env ??= {};
import { j as jsonResponse, c as corsResponse } from '../../../chunks/cors_BtEn6YS3.mjs';
import { a as authenticateRequest } from '../../../chunks/auth_DY7lpPdY.mjs';
import { g as getNeonClient } from '../../../chunks/neon_CxLPHwrs.mjs';
export { r as renderers } from '../../../chunks/_@astro-renderers_BvXjVE0w.mjs';

const OPTIONS = async () => corsResponse();
function generateSlug() {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  let slug = "";
  for (let i = 0; i < 8; i++) {
    slug += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return slug;
}
const POST = async ({ request }) => {
  const userId = await authenticateRequest(request);
  if (!userId) return jsonResponse({ error: "Missing or invalid Authorization header" }, 401);
  const sql = getNeonClient();
  try {
    const { collectionId, enable } = await request.json();
    if (!collectionId) {
      return jsonResponse({ error: "collectionId is required" }, 400);
    }
    const existing = await sql`
      SELECT id, share_slug, is_public FROM user_collections
      WHERE id = ${collectionId} AND clerk_user_id = ${userId}
    `;
    if (existing.length === 0) {
      return jsonResponse({ error: "Collection not found" }, 404);
    }
    if (enable === false) {
      await sql`
        UPDATE user_collections
        SET share_slug = NULL, is_public = false, updated_at = NOW()
        WHERE id = ${collectionId} AND clerk_user_id = ${userId}
      `;
      return jsonResponse({ share_slug: null, is_public: false });
    }
    let shareSlug = existing[0].share_slug;
    if (!shareSlug) {
      for (let attempt = 0; attempt < 5; attempt++) {
        shareSlug = generateSlug();
        const dup = await sql`
          SELECT id FROM user_collections WHERE share_slug = ${shareSlug}
        `;
        if (dup.length === 0) break;
      }
    }
    const rows = await sql`
      UPDATE user_collections
      SET share_slug = ${shareSlug}, is_public = true, updated_at = NOW()
      WHERE id = ${collectionId} AND clerk_user_id = ${userId}
      RETURNING share_slug, is_public
    `;
    return jsonResponse({ share_slug: rows[0].share_slug, is_public: true });
  } catch (error) {
    console.error("Share toggle error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
};
const GET = async ({ request }) => {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  if (!slug) {
    return jsonResponse({ error: "slug parameter is required" }, 400);
  }
  const sql = getNeonClient();
  try {
    const collections = await sql`
      SELECT uc.id, uc.name, uc.share_slug, uc.clerk_user_id, uc.created_at
      FROM user_collections uc
      WHERE uc.share_slug = ${slug} AND uc.is_public = true
    `;
    if (collections.length === 0) {
      return jsonResponse({ error: "Collection not found" }, 404);
    }
    const collection = collections[0];
    const items = await sql`
      SELECT component_type, component_path, component_name, component_category
      FROM collection_items
      WHERE collection_id = ${collection.id}
      ORDER BY added_at ASC
    `;
    let displayName = "user";
    try {
      const { createClerkClient } = await import('../../../chunks/index_BRJRoD4-.mjs');
      const clerkSecret = process.env.CLERK_SECRET_KEY || process.env.CLERK_SECRET_KEY;
      if (clerkSecret) {
        const clerk = createClerkClient({ secretKey: clerkSecret });
        const user = await clerk.users.getUser(collection.clerk_user_id);
        displayName = user.username || user.firstName || "user";
      }
    } catch {
    }
    return jsonResponse({
      collection: {
        name: collection.name,
        share_slug: collection.share_slug,
        created_at: collection.created_at,
        author: displayName,
        items
      }
    });
  } catch (error) {
    console.error("Share GET error:", error);
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
