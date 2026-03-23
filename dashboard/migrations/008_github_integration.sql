-- Migration: GitHub Integration Dashboard
-- Description: Creates tables for caching GitHub API responses and storing analytics
-- Created: 2026-03-23

-- Create github_stats_cache table for caching API responses
CREATE TABLE IF NOT EXISTS github_stats_cache (
  id SERIAL PRIMARY KEY,
  cache_key VARCHAR(255) UNIQUE NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  last_accessed_at TIMESTAMP DEFAULT NOW(),
  access_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_github_cache_key ON github_stats_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_github_expires_at ON github_stats_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_github_last_accessed ON github_stats_cache(last_accessed_at);

COMMENT ON TABLE github_stats_cache IS 'Caches GitHub API responses to minimize API calls';
COMMENT ON COLUMN github_stats_cache.cache_key IS 'Unique identifier for cached data (e.g., "overview:anthropics/claude-code-templates")';
COMMENT ON COLUMN github_stats_cache.data IS 'JSON data from GitHub API';
COMMENT ON COLUMN github_stats_cache.expires_at IS 'When cache entry expires (TTL: 15 minutes)';
COMMENT ON COLUMN github_stats_cache.access_count IS 'Number of times cache was accessed';

-- Create github_rate_limits table for tracking API rate limits
CREATE TABLE IF NOT EXISTS github_rate_limits (
  id SERIAL PRIMARY KEY,
  endpoint VARCHAR(255) NOT NULL,
  limit_total INTEGER NOT NULL,
  limit_remaining INTEGER NOT NULL,
  limit_reset TIMESTAMP NOT NULL,
  checked_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_github_rate_endpoint ON github_rate_limits(endpoint);
CREATE INDEX IF NOT EXISTS idx_github_rate_checked ON github_rate_limits(checked_at);

COMMENT ON TABLE github_rate_limits IS 'Tracks GitHub API rate limit status';
COMMENT ON COLUMN github_rate_limits.endpoint IS 'GitHub API endpoint (e.g., "/repos/{owner}/{repo}")';
COMMENT ON COLUMN github_rate_limits.limit_remaining IS 'Remaining requests before rate limit';
COMMENT ON COLUMN github_rate_limits.limit_reset IS 'When rate limit resets';

-- Create github_stats_history table for historical snapshots
CREATE TABLE IF NOT EXISTS github_stats_history (
  id SERIAL PRIMARY KEY,
  repo_owner VARCHAR(255) NOT NULL,
  repo_name VARCHAR(255) NOT NULL,
  snapshot_date DATE NOT NULL,
  stars INTEGER NOT NULL,
  forks INTEGER NOT NULL,
  open_issues INTEGER NOT NULL,
  open_prs INTEGER NOT NULL,
  contributors INTEGER NOT NULL,
  commits_30d INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(repo_owner, repo_name, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_github_history_repo ON github_stats_history(repo_owner, repo_name);
CREATE INDEX IF NOT EXISTS idx_github_history_date ON github_stats_history(snapshot_date);

COMMENT ON TABLE github_stats_history IS 'Stores daily snapshots of repository statistics for trend analysis';
COMMENT ON COLUMN github_stats_history.snapshot_date IS 'Date of snapshot (one per day)';

-- Create github_components_timeline table for tracking component additions
CREATE TABLE IF NOT EXISTS github_components_timeline (
  id SERIAL PRIMARY KEY,
  component_name VARCHAR(255) NOT NULL,
  component_type VARCHAR(50) NOT NULL CHECK (component_type IN ('agent', 'command', 'hook', 'mcp', 'skill')),
  added_date DATE NOT NULL,
  commit_sha VARCHAR(40) NOT NULL,
  author VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_github_components_type ON github_components_timeline(component_type);
CREATE INDEX IF NOT EXISTS idx_github_components_date ON github_components_timeline(added_date);
CREATE INDEX IF NOT EXISTS idx_github_components_author ON github_components_timeline(author);

COMMENT ON TABLE github_components_timeline IS 'Tracks when components were added to the repository';
COMMENT ON COLUMN github_components_timeline.component_type IS 'Type of component: agent, command, hook, mcp, or skill';
COMMENT ON COLUMN github_components_timeline.commit_sha IS 'Git commit hash where component was added';

-- Create function to auto-clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_github_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM github_stats_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION clean_expired_github_cache IS 'Removes expired cache entries and returns count of deleted rows';

-- Create function to update cache access stats
CREATE OR REPLACE FUNCTION update_cache_access(p_cache_key VARCHAR)
RETURNS VOID AS $$
BEGIN
  UPDATE github_stats_cache 
  SET last_accessed_at = NOW(), 
      access_count = access_count + 1 
  WHERE cache_key = p_cache_key;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_cache_access IS 'Updates last accessed time and increments access count for a cache entry';

-- Create function to get cache statistics
CREATE OR REPLACE FUNCTION get_cache_stats()
RETURNS TABLE (
  total_entries BIGINT,
  expired_entries BIGINT,
  valid_entries BIGINT,
  total_size_mb NUMERIC,
  avg_access_count NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_entries,
    COUNT(*) FILTER (WHERE expires_at < NOW())::BIGINT as expired_entries,
    COUNT(*) FILTER (WHERE expires_at >= NOW())::BIGINT as valid_entries,
    ROUND(pg_total_relation_size('github_stats_cache')::NUMERIC / 1024 / 1024, 2) as total_size_mb,
    ROUND(AVG(access_count), 2) as avg_access_count
  FROM github_stats_cache;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_cache_stats IS 'Returns statistics about the cache table';

-- Insert initial rate limit tracking entry
INSERT INTO github_rate_limits (endpoint, limit_total, limit_remaining, limit_reset)
VALUES ('initial', 5000, 5000, NOW() + INTERVAL '1 hour')
ON CONFLICT DO NOTHING;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'GitHub Integration Dashboard migration completed successfully';
  RAISE NOTICE 'Created tables: github_stats_cache, github_rate_limits, github_stats_history, github_components_timeline';
  RAISE NOTICE 'Created functions: clean_expired_github_cache(), update_cache_access(), get_cache_stats()';
END $$;
