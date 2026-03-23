-- AI Generations tracking table
CREATE TABLE IF NOT EXISTS ai_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL,
  
  -- Generation details
  component_type TEXT NOT NULL,
  user_description TEXT NOT NULL,
  generated_content TEXT NOT NULL,
  component_name TEXT NOT NULL,
  
  -- AI metadata
  model_used TEXT DEFAULT 'claude-3-5-sonnet-20241022',
  tokens_used INTEGER,
  generation_time_ms INTEGER,
  
  -- Status
  status TEXT DEFAULT 'success',
  validation_passed BOOLEAN DEFAULT TRUE,
  validation_warnings TEXT[],
  
  -- User actions
  was_saved BOOLEAN DEFAULT FALSE,
  was_shared BOOLEAN DEFAULT FALSE,
  was_edited BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  saved_at TIMESTAMP,
  
  -- Context
  project_context JSONB
);

CREATE INDEX IF NOT EXISTS idx_generations_user ON ai_generations(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_generations_type ON ai_generations(component_type);
CREATE INDEX IF NOT EXISTS idx_generations_created ON ai_generations(created_at DESC);

-- Usage tracking and rate limiting
CREATE TABLE IF NOT EXISTS ai_usage_limits (
  clerk_user_id TEXT PRIMARY KEY,
  generations_this_month INTEGER DEFAULT 0,
  last_generation_at TIMESTAMP,
  monthly_limit INTEGER DEFAULT 5,
  is_pro BOOLEAN DEFAULT FALSE
);
