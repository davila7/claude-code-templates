-- Component Improvement Loop - Database Schema
-- Run against the existing Neon database

CREATE TABLE IF NOT EXISTS review_cycles (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  component_path TEXT NOT NULL,
  component_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  phase TEXT NOT NULL DEFAULT 'selection',
  pr_url TEXT,
  pr_number INTEGER,
  branch_name TEXT,
  linear_issue_id TEXT,
  improvements_summary TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS tool_executions (
  id BIGSERIAL PRIMARY KEY,
  cycle_id BIGINT REFERENCES review_cycles(id),
  session_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  tool_args_summary TEXT,
  phase TEXT,
  result_status TEXT DEFAULT 'success',
  result_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cycle_control (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  is_paused BOOLEAN DEFAULT false,
  paused_by TEXT,
  reason TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO cycle_control (id, is_paused) VALUES (1, false) ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_review_cycles_status ON review_cycles(status);
CREATE INDEX IF NOT EXISTS idx_review_cycles_session ON review_cycles(session_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_cycle ON tool_executions(cycle_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tool_executions_session ON tool_executions(session_id);
