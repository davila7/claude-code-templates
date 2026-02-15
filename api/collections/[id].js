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

export default async function handler(req, res) {
  setCorsHeaders(res);

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

  const supabase = getSupabaseClient();

  // Verify ownership
  const { data: collection, error: fetchError } = await supabase
    .from('user_collections')
    .select('id')
    .eq('id', id)
    .eq('clerk_user_id', auth.userId)
    .single();

  if (fetchError || !collection) {
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
      const { data: updated, error } = await supabase
        .from('user_collections')
        .update({ name: name.trim(), updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('clerk_user_id', auth.userId)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({ error: 'A collection with this name already exists' });
        }
        throw error;
      }

      return res.status(200).json({ collection: updated });
    } catch (err) {
      console.error('Rename collection error:', err);
      return res.status(500).json({ error: 'Failed to rename collection' });
    }
  }

  // DELETE - Delete collection (cascade deletes items)
  if (req.method === 'DELETE') {
    try {
      const { error } = await supabase
        .from('user_collections')
        .delete()
        .eq('id', id)
        .eq('clerk_user_id', auth.userId);

      if (error) throw error;

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Delete collection error:', err);
      return res.status(500).json({ error: 'Failed to delete collection' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
