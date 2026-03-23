-- Jobs Enhancement Migration
-- Phase 1: User saved jobs, job alerts, and analytics

-- User saved jobs table
CREATE TABLE IF NOT EXISTS saved_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  saved_at TIMESTAMP DEFAULT NOW(),
  notes TEXT,
  status TEXT DEFAULT 'saved', -- 'saved', 'applied', 'interview', 'offer', 'rejected'
  UNIQUE(user_id, job_id)
);

CREATE INDEX idx_saved_jobs_user_id ON saved_jobs(user_id);
CREATE INDEX idx_saved_jobs_status ON saved_jobs(status);

-- Job alerts table
CREATE TABLE IF NOT EXISTS job_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  filters JSONB NOT NULL, -- {salary_min, salary_max, experience_level, tech_stack, location, remote, etc}
  frequency TEXT DEFAULT 'daily', -- 'instant', 'daily', 'weekly'
  enabled BOOLEAN DEFAULT true,
  last_sent TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_job_alerts_user_id ON job_alerts(user_id);
CREATE INDEX idx_job_alerts_enabled ON job_alerts(enabled);

-- Job analytics table
CREATE TABLE IF NOT EXISTS job_analytics (
  job_id TEXT PRIMARY KEY,
  views INT DEFAULT 0,
  clicks INT DEFAULT 0,
  applications INT DEFAULT 0,
  saves INT DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_job_analytics_views ON job_analytics(views DESC);
CREATE INDEX idx_job_analytics_clicks ON job_analytics(clicks DESC);

-- Job application notes
CREATE TABLE IF NOT EXISTS job_application_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_job_application_notes_user_job ON job_application_notes(user_id, job_id);
