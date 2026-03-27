-- ============================================================================
-- Migration: {{MIGRATION_NAME}}
-- Created: {{TIMESTAMP}}
-- Description: {{DESCRIPTION}}
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TABLES (in dependency order)
-- ============================================================================

-- Table: {{TABLE_NAME}}
-- Description: {{TABLE_DESCRIPTION}}
-- Source: {{SOURCE_FILE}}
CREATE TABLE {{TABLE_NAME}} (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  {{COLUMNS}},
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Add table comments
COMMENT ON TABLE {{TABLE_NAME}} IS '{{TABLE_DESCRIPTION}}';
{{COLUMN_COMMENTS}}

-- ============================================================================
-- INDEXES
-- ============================================================================

{{INDEXES}}

-- ============================================================================
-- FOREIGN KEYS
-- ============================================================================

{{FOREIGN_KEYS}}

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for {{TABLE_NAME}}
CREATE TRIGGER update_{{TABLE_NAME}}_updated_at
  BEFORE UPDATE ON {{TABLE_NAME}}
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on {{TABLE_NAME}}
ALTER TABLE {{TABLE_NAME}} ENABLE ROW LEVEL SECURITY;

{{RLS_POLICIES}}

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON {{TABLE_NAME}} TO authenticated;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
