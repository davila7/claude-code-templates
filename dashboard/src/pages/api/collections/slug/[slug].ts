import type { APIRoute } from 'astro';
import { corsResponse, jsonResponse } from '../../../../lib/api/cors';
import { authenticateRequest } from '../../../../lib/api/auth';
import { getNeonClient } from '../../../../lib/api/neon';

export const OPTIONS: APIRoute = async () => corsResponse();

export const GET: APIRoute = async ({ params, request }) => {
  const { slug } = params;
  if (!slug) return jsonResponse({ error: 'Slug is required' }, 400);

  const sql = getNeonClient();
  if (!sql) {
    return jsonResponse({ error: 'Database not configured. This feature requires cloud setup.' }, 503);
  }
  
  // Optional auth to check if user liked it
  const userId = await authenticateRequest(request).catch(() => null);

  try {
    const collections = await sql`
      SELECT 
        uc.*,
        COUNT(DISTINCT cl.id) as like_count,
        ${userId ? sql`EXISTS(SELECT 1 FROM collection_likes WHERE collection_id = uc.id AND user_id = ${userId})` : sql`FALSE`} as is_liked
      FROM user_collections uc
      LEFT JOIN collection_likes cl ON cl.collection_id = uc.id
      WHERE uc.slug = ${slug} AND uc.is_public = TRUE
      GROUP BY uc.id
    `;

    if (collections.length === 0) {
      return jsonResponse({ error: 'Collection not found' }, 404);
    }

    const collection = collections[0];

    // Get items
    const items = await sql`
      SELECT * FROM collection_items
      WHERE collection_id = ${collection.id}
      ORDER BY added_at ASC
    `;

    // Track view (anonymous or authenticated)
    await sql`
      INSERT INTO collection_views (collection_id, viewer_id)
      VALUES (${collection.id}, ${userId})
    `;

    // Update view count
    await sql`
      UPDATE user_collections
      SET view_count = view_count + 1, last_viewed_at = NOW()
      WHERE id = ${collection.id}
    `;

    const result = { ...collection, collection_items: items };
    return jsonResponse({ collection: result });
  } catch (error) {
    console.error('Collection slug error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
};
