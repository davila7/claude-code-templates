-- Schema for tracking CLI command usage in Neon Database

-- Main table: command execution logs
CREATE TABLE IF NOT EXISTS command_usage_logs (
  id SERIAL PRIMARY KEY,
  command_name VARCHAR(100) NOT NULL,
  cli_version VARCHAR(50),
  node_version VARCHAR(50),
  platform VARCHAR(50),
  arch VARCHAR(50),
  execution_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  session_id VARCHAR(100),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: aggregated command statistics
CREATE TABLE IF NOT EXISTS command_usage_stats (
  id SERIAL PRIMARY KEY,
  command_name VARCHAR(100) NOT NULL UNIQUE,
  total_executions BIGINT DEFAULT 0,
  last_execution TIMESTAMP WITH TIME ZONE,
  first_execution TIMESTAMP WITH TIME ZONE,
  unique_sessions BIGINT DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for optimization
CREATE INDEX idx_command_logs_name ON command_usage_logs(command_name);
CREATE INDEX idx_command_logs_timestamp ON command_usage_logs(execution_timestamp DESC);
CREATE INDEX idx_command_logs_session ON command_usage_logs(session_id);
CREATE INDEX idx_command_logs_platform ON command_usage_logs(platform);
CREATE INDEX idx_command_stats_name ON command_usage_stats(command_name);

-- Function to update command stats automatically
CREATE OR REPLACE FUNCTION update_command_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Upsert command statistics
  INSERT INTO command_usage_stats (
    command_name,
    total_executions,
    last_execution,
    first_execution,
    unique_sessions
  )
  VALUES (
    NEW.command_name,
    1,
    NEW.execution_timestamp,
    NEW.execution_timestamp,
    1
  )
  ON CONFLICT (command_name) DO UPDATE SET
    total_executions = command_usage_stats.total_executions + 1,
    last_execution = NEW.execution_timestamp,
    unique_sessions = (
      SELECT COUNT(DISTINCT session_id)
      FROM command_usage_logs
      WHERE command_name = NEW.command_name
    ),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update stats on new command log
CREATE TRIGGER trigger_update_command_stats
  AFTER INSERT ON command_usage_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_command_stats();

-- View: Daily command usage
CREATE OR REPLACE VIEW daily_command_usage AS
SELECT
  command_name,
  DATE(execution_timestamp) as date,
  COUNT(*) as executions,
  COUNT(DISTINCT session_id) as unique_users,
  COUNT(DISTINCT platform) as platforms_count
FROM command_usage_logs
GROUP BY command_name, DATE(execution_timestamp)
ORDER BY date DESC, executions DESC;

-- View: Platform distribution
CREATE OR REPLACE VIEW platform_distribution AS
SELECT
  platform,
  COUNT(*) as total_executions,
  COUNT(DISTINCT command_name) as unique_commands,
  COUNT(DISTINCT session_id) as unique_users
FROM command_usage_logs
GROUP BY platform
ORDER BY total_executions DESC;

-- View: Most popular commands (last 30 days)
CREATE OR REPLACE VIEW popular_commands_30d AS
SELECT
  command_name,
  COUNT(*) as executions,
  COUNT(DISTINCT session_id) as unique_users,
  MAX(execution_timestamp) as last_used
FROM command_usage_logs
WHERE execution_timestamp > NOW() - INTERVAL '30 days'
GROUP BY command_name
ORDER BY executions DESC;

-- Comments for documentation
COMMENT ON TABLE command_usage_logs IS 'Raw logs of every CLI command execution';
COMMENT ON TABLE command_usage_stats IS 'Aggregated statistics for each command';
COMMENT ON VIEW daily_command_usage IS 'Daily breakdown of command usage';
COMMENT ON VIEW platform_distribution IS 'Usage distribution across platforms (macOS, Linux, Windows)';
COMMENT ON VIEW popular_commands_30d IS 'Most popular commands in the last 30 days';
