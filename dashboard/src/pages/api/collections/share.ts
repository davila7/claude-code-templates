import type { APIRoute } from 'astro';
import { corsResponse, jsonResponse } from '../../../lib/api/cors';
import { authenticateRequest } from '../../../lib/api/auth';
import { getNeonClient } from '../../../lib/api/neon';

export const OPTIONS: APIRoute = async () => corsResponse();

function generateSlug(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  let slug = '';
  for (let i = 0; i < 8; i++) {
    slug += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return slug;
}

// POST: Toggle sharing on a collection (generate or remove share slug)
export const POST: APIRoute = async ({ request }) => {
  const userId = await authenticateRequest(request);
  if (!userId) return jsonResponse({ error: 'Missing or invalid Authorization header' }, 401);

  const sql = getNeonClient();

  try {
    const { collectionId, enable } = await request.json();

    if (!collectionId) {
      return jsonResponse({ error: 'collectionId is required' }, 400);
    }

    const existing = await sql`
      SELECT id, share_slug, is_public FROM user_collections
      WHERE id = ${collectionId} AND clerk_user_id = ${userId}
    `;
    if (existing.length === 0) {
      return jsonResponse({ error: 'Collection not found' }, 404);
    }

    if (enable === false) {
      // Disable sharing
      await sql`
        UPDATE user_collections
        SET share_slug = NULL, is_public = false, updated_at = NOW()
        WHERE id = ${collectionId} AND clerk_user_id = ${userId}
      `;
      return jsonResponse({ share_slug: null, is_public: false });
    }

    // Enable sharing — reuse existing slug or generate new one
    let shareSlug = existing[0].share_slug;
    if (!shareSlug) {
      // Generate unique slug with retry
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
    console.error('Share toggle error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
};

// GET: Fetch a public collection by share_slug (no auth required)
export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug');

  if (!slug) {
    return jsonResponse({ error: 'slug parameter is required' }, 400);
  }

  const sql = getNeonClient();

  try {
    const collections = await sql`
      SELECT uc.id, uc.name, uc.share_slug, uc.clerk_user_id, uc.created_at
      FROM user_collections uc
      WHERE uc.share_slug = ${slug} AND uc.is_public = true
    `;

    if (collections.length === 0) {
      return jsonResponse({ error: 'Collection not found' }, 404);
    }

    const collection = collections[0];

    // Only select public-safe fields from collection_items
    const items = await sql`
      SELECT component_type, component_path, component_name, component_category
      FROM collection_items
      WHERE collection_id = ${collection.id}
      ORDER BY added_at ASC
    `;

    // Get display name from Clerk (only username/firstName, never email or IDs)
    let displayName = 'user';
    try {
      const { createClerkClient } = await import('@clerk/backend');
      const clerkSecret = import.meta.env.CLERK_SECRET_KEY || process.env.CLERK_SECRET_KEY;
      if (clerkSecret) {
        const clerk = createClerkClient({ secretKey: clerkSecret });
        const user = await clerk.users.getUser(collection.clerk_user_id);
        displayName = user.username || user.firstName || 'user';
      }
    } catch {
      // Fallback to generic name
    }

    // Return only public-safe data — no IDs, no clerk_user_id, no internal UUIDs
    return jsonResponse({
      collection: {
        name: collection.name,
        share_slug: collection.share_slug,
        created_at: collection.created_at,
        author: displayName,
        items,
      },
    });
  } catch (error) {
    console.error('Share GET error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
};
