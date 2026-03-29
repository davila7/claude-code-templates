-- Add share_slug column to user_collections for public sharing
ALTER TABLE user_collections
  ADD COLUMN IF NOT EXISTS share_slug VARCHAR(20) UNIQUE,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- Index for fast lookups by share_slug
CREATE INDEX IF NOT EXISTS idx_user_collections_share_slug
  ON user_collections (share_slug)
  WHERE share_slug IS NOT NULL;
