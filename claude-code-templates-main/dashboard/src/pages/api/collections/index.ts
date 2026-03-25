import type { APIRoute } from 'astro';
import { corsResponse, jsonResponse } from '../../../lib/api/cors';
import { authenticateRequest } from '../../../lib/api/auth';
import { getNeonClient } from '../../../lib/api/neon';

export const OPTIONS: APIRoute = async () => corsResponse();

export const GET: APIRoute = async ({ request }) => {
  const userId = await authenticateRequest(request);
  if (!userId) return jsonResponse({ error: 'Missing or invalid Authorization header' }, 401);

  const sql = getNeonClient();

  try {
    const collections = await sql`
      SELECT * FROM user_collections
      WHERE clerk_user_id = ${userId}
      ORDER BY position ASC, created_at ASC
    `;

    const items = collections.length > 0
      ? await sql`
          SELECT * FROM collection_items
          WHERE collection_id = ANY(${collections.map((c: any) => c.id)})
          ORDER BY added_at ASC
        `
      : [];

    const itemsByCollection: Record<string, any[]> = {};
    for (const item of items) {
      if (!itemsByCollection[item.collection_id]) {
        itemsByCollection[item.collection_id] = [];
      }
      itemsByCollection[item.collection_id].push(item);
    }

    const result = collections.map((c: any) => ({
      ...c,
      collection_items: itemsByCollection[c.id] || [],
    }));

    return jsonResponse({ collections: result });
  } catch (error) {
    console.error('Collections error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  const userId = await authenticateRequest(request);
  if (!userId) return jsonResponse({ error: 'Missing or invalid Authorization header' }, 401);

  const sql = getNeonClient();

  try {
    const { name } = await request.json();
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return jsonResponse({ error: 'Collection name is required' }, 400);
    }

    if (name.length > 100) {
      return jsonResponse({ error: 'Collection name too long (max 100 characters)' }, 400);
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
    console.error('Collections error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
};
