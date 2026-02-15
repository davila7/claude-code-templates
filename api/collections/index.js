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

  // Verify auth
  const auth = await verifyAuth(req);
  if (!auth.authenticated) {
    return res.status(401).json({ error: auth.error });
  }

  const supabase = getSupabaseClient();

  // GET - List all collections with their items
  if (req.method === 'GET') {
    try {
      const { data: collections, error } = await supabase
        .from('user_collections')
        .select('*, collection_items(*)')
        .eq('clerk_user_id', auth.userId)
        .order('position', { ascending: true });

      if (error) throw error;

      return res.status(200).json({ collections: collections ?? [] });
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
      const { data: existing } = await supabase
        .from('user_collections')
        .select('position')
        .eq('clerk_user_id', auth.userId)
        .order('position', { ascending: false })
        .limit(1);

      const nextPosition = (existing?.[0]?.position ?? -1) + 1;

      const { data: collection, error } = await supabase
        .from('user_collections')
        .insert({
          clerk_user_id: auth.userId,
          name: name.trim(),
          position: nextPosition,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({ error: 'A collection with this name already exists' });
        }
        throw error;
      }

      return res.status(201).json({ collection: { ...collection, collection_items: [] } });
    } catch (err) {
      console.error('Create collection error:', err);
      return res.status(500).json({ error: 'Failed to create collection' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
