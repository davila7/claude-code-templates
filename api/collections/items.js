import { createClient } from '@supabase/supabase-js';
import { verifyAuth, setCorsHeaders } from '../_lib/auth.js';

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration');
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Verify the user owns the given collection.
 */
async function verifyCollectionOwnership(supabase, collectionId, userId) {
  const { data, error } = await supabase
    .from('user_collections')
    .select('id')
    .eq('id', collectionId)
    .eq('clerk_user_id', userId)
    .single();

  return !error && !!data;
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  const auth = await verifyAuth(req);
  if (!auth.authenticated) {
    return res.status(401).json({ error: auth.error });
  }

  const supabase = getSupabaseClient();

  // POST - Add item to collection
  if (req.method === 'POST') {
    const { collectionId, componentType, componentPath, componentName, componentCategory } = req.body;

    if (!collectionId || !componentType || !componentPath || !componentName) {
      return res.status(400).json({ error: 'collectionId, componentType, componentPath, and componentName are required' });
    }

    const isOwner = await verifyCollectionOwnership(supabase, collectionId, auth.userId);
    if (!isOwner) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    try {
      const { data: item, error } = await supabase
        .from('collection_items')
        .insert({
          collection_id: collectionId,
          component_type: componentType,
          component_path: componentPath,
          component_name: componentName,
          component_category: componentCategory ?? null,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({ error: 'Component already in this collection' });
        }
        throw error;
      }

      return res.status(201).json({ item });
    } catch (err) {
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

    const isOwner = await verifyCollectionOwnership(supabase, collectionId, auth.userId);
    if (!isOwner) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    try {
      const { error } = await supabase
        .from('collection_items')
        .delete()
        .eq('id', itemId)
        .eq('collection_id', collectionId);

      if (error) throw error;

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
      verifyCollectionOwnership(supabase, fromCollectionId, auth.userId),
      verifyCollectionOwnership(supabase, toCollectionId, auth.userId),
    ]);

    if (!ownsFrom || !ownsTo) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    try {
      const { data: updated, error } = await supabase
        .from('collection_items')
        .update({ collection_id: toCollectionId })
        .eq('id', itemId)
        .eq('collection_id', fromCollectionId)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({ error: 'Component already exists in target collection' });
        }
        throw error;
      }

      return res.status(200).json({ item: updated });
    } catch (err) {
      console.error('Move item error:', err);
      return res.status(500).json({ error: 'Failed to move item' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
