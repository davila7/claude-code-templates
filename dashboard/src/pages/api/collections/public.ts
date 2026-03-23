import type { APIRoute } from 'astro';
import { corsResponse, jsonResponse } from '../../../lib/api/cors';
import { getNeonClient } from '../../../lib/api/neon';

export const OPTIONS: APIRoute = async () => corsResponse();

export const GET: APIRoute = async ({ url }) => {
  const sql = getNeonClient();
  if (!sql) {
    return jsonResponse({ error: 'Database not configured. This feature requires cloud setup.' }, 503);
  }
  
  const search = url.searchParams.get('search') || '';
  const sortBy = url.searchParams.get('sort') || 'popular'; // popular, recent, liked, a-z
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0');

  try {
    // Build query based on sort
    let orderBy = 'uc.view_count DESC, uc.created_at DESC';
    if (sortBy === 'recent') orderBy = 'uc.created_at DESC';
    else if (sortBy === 'liked') orderBy = 'like_count DESC, uc.created_at DESC';
    else if (sortBy === 'a-z') orderBy = 'uc.name ASC';

    const searchPattern = `%${search}%`;

    const collections = await sql`
      SELECT 
        uc.*,
        COUNT(DISTINCT cl.id) as like_count
      FROM user_collections uc
      LEFT JOIN collection_likes cl ON cl.collection_id = uc.id
      WHERE uc.is_public = TRUE
        AND (
          ${search === ''} OR
          uc.name ILIKE ${searchPattern} OR
          uc.description ILIKE ${searchPattern} OR
          EXISTS (
            SELECT 1 FROM unnest(uc.tags) tag 
            WHERE tag ILIKE ${searchPattern}
          )
        )
      GROUP BY uc.id
      ORDER BY ${sql.unsafe(orderBy)}
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    // Get items for each collection
    const collectionIds = collections.map((c: any) => c.id);
    const items = collectionIds.length > 0
      ? await sql`
          SELECT * FROM collection_items
          WHERE collection_id = ANY(${collectionIds})
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
    console.error('Public collections error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
};
