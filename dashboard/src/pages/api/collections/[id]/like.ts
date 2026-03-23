import type { APIRoute } from 'astro';
import { corsResponse, jsonResponse } from '../../../../lib/api/cors';
import { authenticateRequest } from '../../../../lib/api/auth';
import { getNeonClient } from '../../../../lib/api/neon';

export const OPTIONS: APIRoute = async () => corsResponse();

export const POST: APIRoute = async ({ request, params }) => {
  const userId = await authenticateRequest(request);
  if (!userId) return jsonResponse({ error: 'Missing or invalid Authorization header' }, 401);

  const { id } = params;
  if (!id) return jsonResponse({ error: 'Collection ID is required' }, 400);

  const sql = getNeonClient();
  if (!sql) {
    return jsonResponse({ error: 'Database not configured. This feature requires cloud setup.' }, 503);
  }

  try {
    // Check if collection exists and is public
    const collections = await sql`
      SELECT id FROM user_collections
      WHERE id = ${id} AND is_public = TRUE
    `;
    if (collections.length === 0) {
      return jsonResponse({ error: 'Collection not found' }, 404);
    }

    // Toggle like
    const existing = await sql`
      SELECT id FROM collection_likes
      WHERE collection_id = ${id} AND user_id = ${userId}
    `;

    if (existing.length > 0) {
      // Unlike
      await sql`
        DELETE FROM collection_likes
        WHERE collection_id = ${id} AND user_id = ${userId}
      `;
      return jsonResponse({ liked: false });
    } else {
      // Like
      await sql`
        INSERT INTO collection_likes (collection_id, user_id)
        VALUES (${id}, ${userId})
      `;
      return jsonResponse({ liked: true });
    }
  } catch (error) {
    console.error('Collection like error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
};
