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

  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: 'Collection ID is required' });
  }

  const sql = getSql();

  // Verify ownership
  const [collection] = await sql`
    SELECT id FROM user_collections
    WHERE id = ${id} AND clerk_user_id = ${auth.userId}
  `;

  if (!collection) {
    return res.status(404).json({ error: 'Collection not found' });
  }

  // PATCH - Rename collection
  if (req.method === 'PATCH') {
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Collection name is required' });
    }

    if (name.trim().length > 100) {
      return res.status(400).json({ error: 'Collection name too long (max 100 characters)' });
    }

    try {
      const [updated] = await sql`
        UPDATE user_collections
        SET name = ${name.trim()}, updated_at = now()
        WHERE id = ${id} AND clerk_user_id = ${auth.userId}
        RETURNING *
      `;

      return res.status(200).json({ collection: updated });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'A collection with this name already exists' });
      }
      console.error('Rename collection error:', err);
      return res.status(500).json({ error: 'Failed to rename collection' });
    }
  }

  // DELETE - Delete collection (cascade deletes items)
  if (req.method === 'DELETE') {
    try {
      await sql`
        DELETE FROM user_collections
        WHERE id = ${id} AND clerk_user_id = ${auth.userId}
      `;

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Delete collection error:', err);
      return res.status(500).json({ error: 'Failed to delete collection' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
