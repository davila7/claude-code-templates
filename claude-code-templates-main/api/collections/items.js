import { authenticateRequest } from '../_lib/auth.js';
import { getNeonClient } from '../_lib/neon.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  const userId = await authenticateRequest(req, res);
  if (!userId) return;

  const sql = getNeonClient();

  try {
    if (req.method === 'POST') {
      const { collectionId, componentType, componentPath, componentName, componentCategory } = req.body;

      if (!collectionId || !componentType || !componentPath || !componentName) {
        return res.status(400).json({ error: 'collectionId, componentType, componentPath, and componentName are required' });
      }

      // Verify collection ownership
      const col = await sql`
        SELECT id FROM user_collections
        WHERE id = ${collectionId} AND clerk_user_id = ${userId}
      `;
      if (col.length === 0) {
        return res.status(404).json({ error: 'Collection not found' });
      }

      // Check for duplicate
      const dup = await sql`
        SELECT id FROM collection_items
        WHERE collection_id = ${collectionId} AND component_path = ${componentPath}
      `;
      if (dup.length > 0) {
        return res.status(409).json({ error: 'Component already in this collection' });
      }

      const rows = await sql`
        INSERT INTO collection_items (collection_id, component_type, component_path, component_name, component_category)
        VALUES (${collectionId}, ${componentType}, ${componentPath}, ${componentName}, ${componentCategory || null})
        RETURNING *
      `;

      return res.status(201).json({ item: rows[0] });
    }

    if (req.method === 'DELETE') {
      const { itemId, collectionId } = req.body;

      if (!itemId || !collectionId) {
        return res.status(400).json({ error: 'itemId and collectionId are required' });
      }

      // Verify collection ownership
      const col = await sql`
        SELECT id FROM user_collections
        WHERE id = ${collectionId} AND clerk_user_id = ${userId}
      `;
      if (col.length === 0) {
        return res.status(404).json({ error: 'Collection not found' });
      }

      await sql`
        DELETE FROM collection_items
        WHERE id = ${itemId} AND collection_id = ${collectionId}
      `;

      return res.status(200).json({ success: true });
    }

    if (req.method === 'PATCH') {
      const { itemId, fromCollectionId, toCollectionId } = req.body;

      if (!itemId || !fromCollectionId || !toCollectionId) {
        return res.status(400).json({ error: 'itemId, fromCollectionId, and toCollectionId are required' });
      }

      // Verify ownership of both collections
      const cols = await sql`
        SELECT id FROM user_collections
        WHERE id = ANY(${[fromCollectionId, toCollectionId]}) AND clerk_user_id = ${userId}
      `;
      if (cols.length < 2) {
        return res.status(404).json({ error: 'One or both collections not found' });
      }

      const rows = await sql`
        UPDATE collection_items
        SET collection_id = ${toCollectionId}
        WHERE id = ${itemId} AND collection_id = ${fromCollectionId}
        RETURNING *
      `;

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Item not found in source collection' });
      }

      return res.status(200).json({ item: rows[0] });
    }

    return res.status(405).json({ error: 'Method not allowed', allowed: ['POST', 'DELETE', 'PATCH'] });
  } catch (error) {
    console.error('Collection items error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
