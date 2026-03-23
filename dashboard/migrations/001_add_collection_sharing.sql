-- Phase 2 & 3: Add sharing and metadata fields to user_collections
ALTER TABLE user_collections
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[],
ADD COLUMN IF NOT EXISTS created_by_name TEXT,
ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMP;

-- Create indexes for public collections
CREATE INDEX IF NOT EXISTS idx_collections_public ON user_collections(is_public) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_collections_slug ON user_collections(slug);

-- Phase 4: Create collection views table (analytics)
CREATE TABLE IF NOT EXISTS collection_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID REFERENCES user_collections(id) ON DELETE CASCADE,
  viewer_id TEXT,  -- clerk_user_id or null for anonymous
  viewed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_views_collection ON collection_views(collection_id);
CREATE INDEX IF NOT EXISTS idx_views_viewer ON collection_views(viewer_id);

-- Phase 4: Create collection likes table
CREATE TABLE IF NOT EXISTS collection_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID REFERENCES user_collections(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,  -- clerk_user_id
  liked_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_collection_like UNIQUE (collection_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_collection ON collection_likes(collection_id);
CREATE INDEX IF NOT EXISTS idx_likes_user ON collection_likes(user_id);

-- Phase 7: Create component installations table
CREATE TABLE IF NOT EXISTS component_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL,
  
  -- Component info
  component_type TEXT NOT NULL,
  component_path TEXT NOT NULL,
  component_name TEXT NOT NULL,
  component_category TEXT,
  
  -- Version tracking
  installed_version TEXT,
  current_version TEXT,
  is_outdated BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  installed_at TIMESTAMP DEFAULT NOW(),
  last_checked_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP,
  
  -- Metadata
  install_source TEXT,
  install_command TEXT,
  
  CONSTRAINT unique_user_component UNIQUE (clerk_user_id, component_path)
);

CREATE INDEX IF NOT EXISTS idx_installations_user ON component_installations(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_installations_outdated ON component_installations(is_outdated) WHERE is_outdated = TRUE;

-- Phase 7: Create update notifications table
CREATE TABLE IF NOT EXISTS update_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL,
  
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  notification_type TEXT DEFAULT 'component_update',
  
  component_paths TEXT[],
  total_updates INTEGER DEFAULT 0,
  
  is_read BOOLEAN DEFAULT FALSE,
  is_dismissed BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  read_at TIMESTAMP,
  
  action_url TEXT,
  action_label TEXT
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON update_notifications(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON update_notifications(clerk_user_id, is_read) WHERE is_read = FALSE;

-- Function to generate unique slug
CREATE OR REPLACE FUNCTION generate_collection_slug(collection_name TEXT, user_id TEXT)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Create base slug from name
  base_slug := lower(regexp_replace(collection_name, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  
  -- Try base slug first
  final_slug := base_slug;
  
  -- If slug exists, append counter
  WHILE EXISTS (SELECT 1 FROM user_collections WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;
