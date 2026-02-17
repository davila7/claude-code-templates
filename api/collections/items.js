import { neon } from '@neondatabase/serverless';
import { verifyAuth, setCorsHeaders } from '../_lib/auth.js';

function getSql() {
  if (!process.env.NEON_DATABASE_URL) {
    throw new Error('Missing NEON_DATABASE_URL');
  }
  return neon(process.env.NEON_DATABASE_URL);
}

/**
 * Verify the user owns the given collection.
 */
async function verifyCollectionOwnership(sql, collectionId, userId) {
  const [row] = await sql`
    SELECT id FROM user_collections
    WHERE id = ${collectionId} AND clerk_user_id = ${userId}
  `;
  return !!row;
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

  // POST - Add item to collection
  if (req.method === 'POST') {
    const { collectionId, componentType, componentPath, componentName, componentCategory } = req.body;

    if (!collectionId || !componentType || !componentPath || !componentName) {
      return res.status(400).json({ error: 'collectionId, componentType, componentPath, and componentName are required' });
    }

    const isOwner = await verifyCollectionOwnership(sql, collectionId, auth.userId);
    if (!isOwner) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    try {
      const [item] = await sql`
        INSERT INTO collection_items (collection_id, component_type, component_path, component_name, component_category)
        VALUES (${collectionId}, ${componentType}, ${componentPath}, ${componentName}, ${componentCategory ?? null})
        RETURNING *
      `;

      return res.status(201).json({ item });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Component already in this collection' });
      }
      console.error('Add item error:', err);
      return res.status(500).json({ error: 'Failed to add item' });
    }
  }

  // DELETE - Remove item from collection
  if (req.method === 'DELETE') {
    const { itemId, collectionId } = req.body;

    if (!itemId || !collectionId) {
      return res.status(400).json({ error: 'itemId and collectionId are required' });
    }

    const isOwner = await verifyCollectionOwnership(sql, collectionId, auth.userId);
    if (!isOwner) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    try {
      await sql`
        DELETE FROM collection_items
        WHERE id = ${itemId} AND collection_id = ${collectionId}
      `;

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Remove item error:', err);
      return res.status(500).json({ error: 'Failed to remove item' });
    }
  }

  // PATCH - Move item to a different collection
  if (req.method === 'PATCH') {
    const { itemId, fromCollectionId, toCollectionId } = req.body;

    if (!itemId || !fromCollectionId || !toCollectionId) {
      return res.status(400).json({ error: 'itemId, fromCollectionId, and toCollectionId are required' });
    }

    // Verify ownership of both collections
    const [ownsFrom, ownsTo] = await Promise.all([
      verifyCollectionOwnership(sql, fromCollectionId, auth.userId),
      verifyCollectionOwnership(sql, toCollectionId, auth.userId),
    ]);

    if (!ownsFrom || !ownsTo) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    try {
      const [updated] = await sql`
        UPDATE collection_items
        SET collection_id = ${toCollectionId}
        WHERE id = ${itemId} AND collection_id = ${fromCollectionId}
        RETURNING *
      `;

      if (!updated) {
        return res.status(404).json({ error: 'Item not found' });
      }

      return res.status(200).json({ item: updated });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Component already exists in target collection' });
      }
      console.error('Move item error:', err);
      return res.status(500).json({ error: 'Failed to move item' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
