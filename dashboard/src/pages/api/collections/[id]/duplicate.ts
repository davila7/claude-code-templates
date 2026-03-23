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
    // Get source collection (must be public or owned by user)
    const sourceCollections = await sql`
      SELECT * FROM user_collections
      WHERE id = ${id} AND (is_public = TRUE OR clerk_user_id = ${userId})
    `;
    if (sourceCollections.length === 0) {
      return jsonResponse({ error: 'Collection not found' }, 404);
    }

    const source = sourceCollections[0];

    // Get max position for user
    const maxPos = await sql`
      SELECT COALESCE(MAX(position), -1) AS max_pos
      FROM user_collections
      WHERE clerk_user_id = ${userId}
    `;
    const newPosition = maxPos[0].max_pos + 1;

    // Create new collection
    const newCollections = await sql`
      INSERT INTO user_collections (
        clerk_user_id,
        name,
        description,
        is_public,
        position
      )
      VALUES (
        ${userId},
        ${source.name + ' (Copy)'},
        ${source.description},
        FALSE,
        ${newPosition}
      )
      RETURNING *
    `;

    const newCollection = newCollections[0];

    // Copy items
    const sourceItems = await sql`
      SELECT * FROM collection_items
      WHERE collection_id = ${id}
    `;

    for (const item of sourceItems) {
      await sql`
        INSERT INTO collection_items (
          collection_id,
          component_type,
          component_path,
          component_name,
          component_category
        )
        VALUES (
          ${newCollection.id},
          ${item.component_type},
          ${item.component_path},
          ${item.component_name},
          ${item.component_category}
        )
      `;
    }

    // Get items for response
    const items = await sql`
      SELECT * FROM collection_items
      WHERE collection_id = ${newCollection.id}
      ORDER BY added_at ASC
    `;

    const result = { ...newCollection, collection_items: items };
    return jsonResponse({ collection: result }, 201);
  } catch (error) {
    console.error('Collection duplicate error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
};
