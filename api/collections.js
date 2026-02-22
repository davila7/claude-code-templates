import { authenticateRequest } from './_lib/auth.js';
import { getNeonClient } from './_lib/neon.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  const userId = await authenticateRequest(req, res);
  if (!userId) return;

  const sql = getNeonClient();

  try {
    if (req.method === 'GET') {
      const collections = await sql`
        SELECT * FROM user_collections
        WHERE clerk_user_id = ${userId}
        ORDER BY position ASC, created_at ASC
      `;

      const items = collections.length > 0
        ? await sql`
            SELECT * FROM collection_items
            WHERE collection_id = ANY(${collections.map(c => c.id)})
            ORDER BY added_at ASC
          `
        : [];

      const itemsByCollection = {};
      for (const item of items) {
        if (!itemsByCollection[item.collection_id]) {
          itemsByCollection[item.collection_id] = [];
        }
        itemsByCollection[item.collection_id].push(item);
      }

      const result = collections.map(c => ({
        ...c,
        collection_items: itemsByCollection[c.id] || [],
      }));

      return res.status(200).json({ collections: result });
    }

    if (req.method === 'POST') {
      const { name } = req.body;
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Collection name is required' });
      }

      if (name.length > 100) {
        return res.status(400).json({ error: 'Collection name too long (max 100 characters)' });
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
      return res.status(201).json({ collection });
    }

    return res.status(405).json({ error: 'Method not allowed', allowed: ['GET', 'POST'] });
  } catch (error) {
    console.error('Collections error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
