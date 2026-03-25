import { authenticateRequest } from '../_lib/auth.js';
import { getNeonClient } from '../_lib/neon.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  const userId = await authenticateRequest(req, res);
  if (!userId) return;

  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: 'Collection ID is required' });
  }

  const sql = getNeonClient();

  try {
    // Verify ownership
    const existing = await sql`
      SELECT id FROM user_collections
      WHERE id = ${id} AND clerk_user_id = ${userId}
    `;

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    if (req.method === 'PATCH') {
      const { name } = req.body;
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Collection name is required' });
      }

      if (name.length > 100) {
        return res.status(400).json({ error: 'Collection name too long (max 100 characters)' });
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
      return res.status(200).json({ collection });
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM collection_items WHERE collection_id = ${id}`;
      await sql`DELETE FROM user_collections WHERE id = ${id} AND clerk_user_id = ${userId}`;

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed', allowed: ['PATCH', 'DELETE'] });
  } catch (error) {
    console.error('Collection [id] error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
