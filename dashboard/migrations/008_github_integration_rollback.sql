-- Rollback: GitHub Integration Dashboard
-- Description: Removes all tables and functions created by 008_github_integration.sql
-- Created: 2026-03-23

-- Drop functions
DROP FUNCTION IF EXISTS get_cache_stats();
DROP FUNCTION IF EXISTS update_cache_access(VARCHAR);
DROP FUNCTION IF EXISTS clean_expired_github_cache();

-- Drop tables (in reverse order of dependencies)
DROP TABLE IF EXISTS github_components_timeline;
DROP TABLE IF EXISTS github_stats_history;
DROP TABLE IF EXISTS github_rate_limits;
DROP TABLE IF EXISTS github_stats_cache;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'GitHub Integration Dashboard rollback completed successfully';
  RAISE NOTICE 'Removed tables: github_stats_cache, github_rate_limits, github_stats_history, github_components_timeline';
  RAISE NOTICE 'Removed functions: clean_expired_github_cache(), update_cache_access(), get_cache_stats()';
END $$;
