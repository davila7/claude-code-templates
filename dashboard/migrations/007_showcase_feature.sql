-- Community Showcase Feature - Complete Migration
-- This migration creates all tables, indexes, and triggers for the Community Showcase feature

-- ============================================================================
-- TABLES
-- ============================================================================

-- Showcase submissions table
CREATE TABLE IF NOT EXISTS showcase_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL,
  
  -- Content
  title TEXT NOT NULL CHECK (char_length(title) >= 5 AND char_length(title) <= 100),
  description TEXT NOT NULL CHECK (char_length(description) >= 20 AND char_length(description) <= 500),
  content TEXT NOT NULL CHECK (char_length(content) >= 100),
  submission_type TEXT NOT NULL CHECK (submission_type IN ('workflow', 'success_story', 'before_after', 'configuration')),
  
  -- Code examples
  code_before TEXT,
  code_after TEXT,
  code_language TEXT DEFAULT 'typescript',
  
  -- Media
  thumbnail_url TEXT,
  demo_url TEXT,
  github_url TEXT,
  video_url TEXT,
  
  -- Metadata
  tags TEXT[] NOT NULL DEFAULT '{}',
  category TEXT NOT NULL,
  difficulty_level TEXT DEFAULT 'intermediate' CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'featured', 'rejected')),
  is_featured BOOLEAN DEFAULT FALSE,
  featured_at TIMESTAMP,
  rejection_reason TEXT,
  
  -- Engagement
  view_count INTEGER DEFAULT 0 CHECK (view_count >= 0),
  like_count INTEGER DEFAULT 0 CHECK (like_count >= 0),
  bookmark_count INTEGER DEFAULT 0 CHECK (bookmark_count >= 0),
  try_count INTEGER DEFAULT 0 CHECK (try_count >= 0),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  approved_at TIMESTAMP,
  
  -- Author info (denormalized for performance)
  author_name TEXT,
  author_avatar TEXT,
  author_github TEXT
);

-- Component of the Week table
CREATE TABLE IF NOT EXISTS component_of_week (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Component reference
  component_type TEXT NOT NULL CHECK (component_type IN ('agent', 'command', 'hook', 'skill', 'other')),
  component_path TEXT NOT NULL,
  component_name TEXT NOT NULL,
  
  -- Week info
  week_start_date DATE NOT NULL UNIQUE,
  week_end_date DATE NOT NULL,
  
  -- Content
  spotlight_title TEXT NOT NULL,
  spotlight_description TEXT NOT NULL,
  spotlight_content TEXT NOT NULL,
  
  -- Featured implementations
  featured_showcase_ids UUID[] DEFAULT '{}',
  
  -- Statistics
  usage_stats JSONB DEFAULT '{}'::jsonb,
  
  -- Creator interview (optional)
  interview_content TEXT,
  interview_video_url TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  published_at TIMESTAMP,
  
  CHECK (week_end_date > week_start_date)
);

-- Showcase reactions table
CREATE TABLE IF NOT EXISTS showcase_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  showcase_id UUID NOT NULL REFERENCES showcase_submissions(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'bookmark', 'try')),
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT unique_user_showcase_reaction UNIQUE (showcase_id, clerk_user_id, reaction_type)
);

-- Showcase comments table
CREATE TABLE IF NOT EXISTS showcase_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  showcase_id UUID NOT NULL REFERENCES showcase_submissions(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) >= 1 AND char_length(content) <= 1000),
  parent_comment_id UUID REFERENCES showcase_comments(id) ON DELETE CASCADE,
  
  -- Engagement
  like_count INTEGER DEFAULT 0 CHECK (like_count >= 0),
  
  -- Status
  is_edited BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_flagged BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Author info (denormalized for performance)
  author_name TEXT,
  author_avatar TEXT
);

-- Showcase views tracking table
CREATE TABLE IF NOT EXISTS showcase_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  showcase_id UUID NOT NULL REFERENCES showcase_submissions(id) ON DELETE CASCADE,
  viewer_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  viewed_at TIMESTAMP DEFAULT NOW()
);

-- Showcase categories reference table
CREATE TABLE IF NOT EXISTS showcase_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default categories
INSERT INTO showcase_categories (id, name, description, icon, sort_order) VALUES
('automation', 'Automation', 'Workflow automation and scripting', '🤖', 1),
('testing', 'Testing', 'Testing strategies and frameworks', '🧪', 2),
('deployment', 'Deployment', 'Deployment and CI/CD workflows', '🚀', 3),
('ai-agents', 'AI Agents', 'AI agent configurations and workflows', '🤖', 4),
('performance', 'Performance', 'Performance optimization techniques', '⚡', 5),
('security', 'Security', 'Security best practices', '🔒', 6),
('best-practices', 'Best Practices', 'General best practices', '✨', 7)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Showcase submissions indexes
CREATE INDEX IF NOT EXISTS idx_showcase_status ON showcase_submissions(status);
CREATE INDEX IF NOT EXISTS idx_showcase_featured ON showcase_submissions(is_featured) WHERE is_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_showcase_type ON showcase_submissions(submission_type);
CREATE INDEX IF NOT EXISTS idx_showcase_category ON showcase_submissions(category);
CREATE INDEX IF NOT EXISTS idx_showcase_created ON showcase_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_showcase_user ON showcase_submissions(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_showcase_status_created ON showcase_submissions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_showcase_tags ON showcase_submissions USING GIN(tags);

-- Showcase reactions indexes
CREATE INDEX IF NOT EXISTS idx_reactions_showcase ON showcase_reactions(showcase_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user ON showcase_reactions(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_reactions_showcase_user ON showcase_reactions(showcase_id, clerk_user_id);

-- Showcase comments indexes
CREATE INDEX IF NOT EXISTS idx_comments_showcase ON showcase_comments(showcase_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON showcase_comments(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON showcase_comments(parent_comment_id) WHERE parent_comment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comments_created ON showcase_comments(created_at DESC);

-- Showcase views indexes
CREATE INDEX IF NOT EXISTS idx_views_showcase ON showcase_views(showcase_id);
CREATE INDEX IF NOT EXISTS idx_views_viewer ON showcase_views(viewer_id) WHERE viewer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_views_viewed_at ON showcase_views(viewed_at DESC);

-- Component of the Week indexes
CREATE INDEX IF NOT EXISTS idx_cotw_week ON component_of_week(week_start_date DESC);
CREATE INDEX IF NOT EXISTS idx_cotw_published ON component_of_week(published_at DESC) WHERE published_at IS NOT NULL;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for showcase_submissions updated_at
DROP TRIGGER IF EXISTS trigger_showcase_updated_at ON showcase_submissions;
CREATE TRIGGER trigger_showcase_updated_at
  BEFORE UPDATE ON showcase_submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for showcase_comments updated_at
DROP TRIGGER IF EXISTS trigger_comments_updated_at ON showcase_comments;
CREATE TRIGGER trigger_comments_updated_at
  BEFORE UPDATE ON showcase_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to increment view count
CREATE OR REPLACE FUNCTION increment_view_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE showcase_submissions
  SET view_count = view_count + 1
  WHERE id = NEW.showcase_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to increment view count on new view
DROP TRIGGER IF EXISTS trigger_increment_view_count ON showcase_views;
CREATE TRIGGER trigger_increment_view_count
  AFTER INSERT ON showcase_views
  FOR EACH ROW
  EXECUTE FUNCTION increment_view_count();

-- Function to update reaction counts
CREATE OR REPLACE FUNCTION update_reaction_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE showcase_submissions
    SET 
      like_count = CASE WHEN NEW.reaction_type = 'like' THEN like_count + 1 ELSE like_count END,
      bookmark_count = CASE WHEN NEW.reaction_type = 'bookmark' THEN bookmark_count + 1 ELSE bookmark_count END,
      try_count = CASE WHEN NEW.reaction_type = 'try' THEN try_count + 1 ELSE try_count END
    WHERE id = NEW.showcase_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE showcase_submissions
    SET 
      like_count = CASE WHEN OLD.reaction_type = 'like' THEN GREATEST(0, like_count - 1) ELSE like_count END,
      bookmark_count = CASE WHEN OLD.reaction_type = 'bookmark' THEN GREATEST(0, bookmark_count - 1) ELSE bookmark_count END,
      try_count = CASE WHEN OLD.reaction_type = 'try' THEN GREATEST(0, try_count - 1) ELSE try_count END
    WHERE id = OLD.showcase_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update reaction counts
DROP TRIGGER IF EXISTS trigger_update_reaction_counts ON showcase_reactions;
CREATE TRIGGER trigger_update_reaction_counts
  AFTER INSERT OR DELETE ON showcase_reactions
  FOR EACH ROW
  EXECUTE FUNCTION update_reaction_counts();

-- Analyze tables
ANALYZE showcase_submissions;
ANALYZE showcase_reactions;
ANALYZE showcase_comments;
ANALYZE showcase_views;
ANALYZE component_of_week;
ANALYZE showcase_categories;
