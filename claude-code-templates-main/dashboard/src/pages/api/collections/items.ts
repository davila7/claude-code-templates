import type { APIRoute } from 'astro';
import { corsResponse, jsonResponse } from '../../../lib/api/cors';
import { authenticateRequest } from '../../../lib/api/auth';
import { getNeonClient } from '../../../lib/api/neon';

export const OPTIONS: APIRoute = async () => corsResponse();

export const POST: APIRoute = async ({ request }) => {
  const userId = await authenticateRequest(request);
  if (!userId) return jsonResponse({ error: 'Missing or invalid Authorization header' }, 401);

  const sql = getNeonClient();

  try {
    const { collectionId, componentType, componentPath, componentName, componentCategory } = await request.json();

    if (!collectionId || !componentType || !componentPath || !componentName) {
      return jsonResponse({ error: 'collectionId, componentType, componentPath, and componentName are required' }, 400);
    }

    const col = await sql`
      SELECT id FROM user_collections
      WHERE id = ${collectionId} AND clerk_user_id = ${userId}
    `;
    if (col.length === 0) {
      return jsonResponse({ error: 'Collection not found' }, 404);
    }

    const dup = await sql`
      SELECT id FROM collection_items
      WHERE collection_id = ${collectionId} AND component_path = ${componentPath}
    `;
    if (dup.length > 0) {
      return jsonResponse({ error: 'Component already in this collection' }, 409);
    }

    const rows = await sql`
      INSERT INTO collection_items (collection_id, component_type, component_path, component_name, component_category)
      VALUES (${collectionId}, ${componentType}, ${componentPath}, ${componentName}, ${componentCategory || null})
      RETURNING *
    `;

    return jsonResponse({ item: rows[0] }, 201);
  } catch (error) {
    console.error('Collection items error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  const userId = await authenticateRequest(request);
  if (!userId) return jsonResponse({ error: 'Missing or invalid Authorization header' }, 401);

  const sql = getNeonClient();

  try {
    const { itemId, collectionId } = await request.json();

    if (!itemId || !collectionId) {
      return jsonResponse({ error: 'itemId and collectionId are required' }, 400);
    }

    const col = await sql`
      SELECT id FROM user_collections
      WHERE id = ${collectionId} AND clerk_user_id = ${userId}
    `;
    if (col.length === 0) {
      return jsonResponse({ error: 'Collection not found' }, 404);
    }

    await sql`
      DELETE FROM collection_items
      WHERE id = ${itemId} AND collection_id = ${collectionId}
    `;

    return jsonResponse({ success: true });
  } catch (error) {
    console.error('Collection items error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
};

export const PATCH: APIRoute = async ({ request }) => {
  const userId = await authenticateRequest(request);
  if (!userId) return jsonResponse({ error: 'Missing or invalid Authorization header' }, 401);

  const sql = getNeonClient();

  try {
    const { itemId, fromCollectionId, toCollectionId } = await request.json();

    if (!itemId || !fromCollectionId || !toCollectionId) {
      return jsonResponse({ error: 'itemId, fromCollectionId, and toCollectionId are required' }, 400);
    }

    const cols = await sql`
      SELECT id FROM user_collections
      WHERE id = ANY(${[fromCollectionId, toCollectionId]}) AND clerk_user_id = ${userId}
    `;
    if (cols.length < 2) {
      return jsonResponse({ error: 'One or both collections not found' }, 404);
    }

    const rows = await sql`
      UPDATE collection_items
      SET collection_id = ${toCollectionId}
      WHERE id = ${itemId} AND collection_id = ${fromCollectionId}
      RETURNING *
    `;

    if (rows.length === 0) {
      return jsonResponse({ error: 'Item not found in source collection' }, 404);
    }

    return jsonResponse({ item: rows[0] });
  } catch (error) {
    console.error('Collection items error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
};
