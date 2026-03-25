import type { APIRoute } from 'astro';
import { corsResponse, jsonResponse } from '../../../lib/api/cors';
import { authenticateRequest } from '../../../lib/api/auth';
import { getNeonClient } from '../../../lib/api/neon';

export const OPTIONS: APIRoute = async () => corsResponse();

export const PATCH: APIRoute = async ({ request, params }) => {
  const userId = await authenticateRequest(request);
  if (!userId) return jsonResponse({ error: 'Missing or invalid Authorization header' }, 401);

  const { id } = params;
  if (!id) return jsonResponse({ error: 'Collection ID is required' }, 400);

  const sql = getNeonClient();

  try {
    const existing = await sql`
      SELECT id FROM user_collections
      WHERE id = ${id} AND clerk_user_id = ${userId}
    `;
    if (existing.length === 0) {
      return jsonResponse({ error: 'Collection not found' }, 404);
    }

    const { name } = await request.json();
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return jsonResponse({ error: 'Collection name is required' }, 400);
    }

    if (name.length > 100) {
      return jsonResponse({ error: 'Collection name too long (max 100 characters)' }, 400);
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
    console.error('Collection [id] error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
};

export const DELETE: APIRoute = async ({ request, params }) => {
  const userId = await authenticateRequest(request);
  if (!userId) return jsonResponse({ error: 'Missing or invalid Authorization header' }, 401);

  const { id } = params;
  if (!id) return jsonResponse({ error: 'Collection ID is required' }, 400);

  const sql = getNeonClient();

  try {
    const existing = await sql`
      SELECT id FROM user_collections
      WHERE id = ${id} AND clerk_user_id = ${userId}
    `;
    if (existing.length === 0) {
      return jsonResponse({ error: 'Collection not found' }, 404);
    }

    await sql`DELETE FROM collection_items WHERE collection_id = ${id}`;
    await sql`DELETE FROM user_collections WHERE id = ${id} AND clerk_user_id = ${userId}`;

    return jsonResponse({ success: true });
  } catch (error) {
    console.error('Collection [id] error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
};
