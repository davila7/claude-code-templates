import { neon } from '@neondatabase/serverless';
import { verifyAuth, setCorsHeaders } from '../_lib/auth.js';

function getSql() {
  if (!process.env.NEON_DATABASE_URL) {
    throw new Error('Missing NEON_DATABASE_URL');
  }
  return neon(process.env.NEON_DATABASE_URL);
}

export default async function handler(req, res) {
  setCorsHeaders(res, req);

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  const auth = await verifyAuth(req);
  if (!auth.authenticated) {
    return res.status(401).json({ error: auth.error });
  }

  const sql = getSql();

  // GET - List all collections with their items
  if (req.method === 'GET') {
    try {
      let collections = await sql`
        SELECT * FROM user_collections
        WHERE clerk_user_id = ${auth.userId}
        ORDER BY position ASC
      `;

      // Auto-create a default "Favorites" collection for new users
      if (collections.length === 0) {
        const [defaultCol] = await sql`
          INSERT INTO user_collections (clerk_user_id, name, position)
          VALUES (${auth.userId}, ${'Favorites'}, ${0})
          RETURNING *
        `;
        collections = [defaultCol];
      }

      // Fetch items for all collections in one query
      const collectionIds = collections.map((c) => c.id);
      let items = [];
      if (collectionIds.length > 0) {
        items = await sql`
          SELECT * FROM collection_items
          WHERE collection_id = ANY(${collectionIds})
          ORDER BY added_at ASC
        `;
      }

      // Group items by collection
      const itemsByCollection = {};
      for (const item of items) {
        if (!itemsByCollection[item.collection_id]) {
          itemsByCollection[item.collection_id] = [];
        }
        itemsByCollection[item.collection_id].push(item);
      }

      const result = collections.map((c) => ({
        ...c,
        collection_items: itemsByCollection[c.id] ?? [],
      }));

      return res.status(200).json({ collections: result });
    } catch (err) {
      console.error('List collections error:', err);
      return res.status(500).json({ error: 'Failed to list collections' });
    }
  }

  // POST - Create a new collection
  if (req.method === 'POST') {
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Collection name is required' });
    }

    if (name.trim().length > 100) {
      return res.status(400).json({ error: 'Collection name too long (max 100 characters)' });
    }

    try {
      // Get max position for ordering
      const [posRow] = await sql`
        SELECT COALESCE(MAX(position), -1) AS max_pos
        FROM user_collections
        WHERE clerk_user_id = ${auth.userId}
      `;
      const nextPosition = (posRow?.max_pos ?? -1) + 1;

      const [collection] = await sql`
        INSERT INTO user_collections (clerk_user_id, name, position)
        VALUES (${auth.userId}, ${name.trim()}, ${nextPosition})
        RETURNING *
      `;

      return res.status(201).json({ collection: { ...collection, collection_items: [] } });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'A collection with this name already exists' });
      }
      console.error('Create collection error:', err);
      return res.status(500).json({ error: 'Failed to create collection' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
