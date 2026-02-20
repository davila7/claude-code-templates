-- Migration: Move collections from Supabase to Neon
-- Run this against NEON_DATABASE_URL

CREATE TABLE IF NOT EXISTS user_collections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clerk_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(clerk_user_id, name)
);

CREATE TABLE IF NOT EXISTS collection_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_id UUID NOT NULL REFERENCES user_collections(id) ON DELETE CASCADE,
  component_type TEXT NOT NULL,
  component_path TEXT NOT NULL,
  component_name TEXT NOT NULL,
  component_category TEXT,
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(collection_id, component_type, component_path)
);

CREATE INDEX IF NOT EXISTS idx_user_collections_clerk_user ON user_collections(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_collection ON collection_items(collection_id);
