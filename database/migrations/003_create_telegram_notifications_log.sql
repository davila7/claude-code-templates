-- Schema for tracking Telegram PR notifications

-- Table: Telegram notification logs for PRs
CREATE TABLE IF NOT EXISTS telegram_notifications_log (
  id SERIAL PRIMARY KEY,
  pr_number INTEGER NOT NULL,
  pr_title TEXT NOT NULL,
  pr_url VARCHAR(500) NOT NULL,
  repository VARCHAR(200) NOT NULL,
  action VARCHAR(50) NOT NULL, -- 'opened', 'synchronize', 'reopened'
  chat_id VARCHAR(100),
  payload JSONB,
  response_status INTEGER,
  response_body TEXT,
  error_message TEXT,
  success BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for optimization
CREATE INDEX idx_telegram_notifications_pr_number ON telegram_notifications_log(pr_number);
CREATE INDEX idx_telegram_notifications_repository ON telegram_notifications_log(repository);
CREATE INDEX idx_telegram_notifications_sent_at ON telegram_notifications_log(sent_at DESC);
CREATE INDEX idx_telegram_notifications_success ON telegram_notifications_log(success);

-- Comments for documentation
COMMENT ON TABLE telegram_notifications_log IS 'Log of all PR notifications sent to Telegram';
COMMENT ON COLUMN telegram_notifications_log.pr_number IS 'Pull Request number';
COMMENT ON COLUMN telegram_notifications_log.pr_title IS 'Pull Request title';
COMMENT ON COLUMN telegram_notifications_log.pr_url IS 'Pull Request URL on GitHub';
COMMENT ON COLUMN telegram_notifications_log.repository IS 'Full repository name (owner/repo)';
COMMENT ON COLUMN telegram_notifications_log.action IS 'Action that triggered the notification (opened, synchronize, reopened)';
COMMENT ON COLUMN telegram_notifications_log.chat_id IS 'Telegram chat ID where notification was sent';
COMMENT ON COLUMN telegram_notifications_log.payload IS 'Full payload sent to Telegram API';
COMMENT ON COLUMN telegram_notifications_log.response_status IS 'HTTP response status code from Telegram';
COMMENT ON COLUMN telegram_notifications_log.response_body IS 'Response body from Telegram API';
COMMENT ON COLUMN telegram_notifications_log.error_message IS 'Error message if notification failed';
COMMENT ON COLUMN telegram_notifications_log.success IS 'Indicates if notification was sent successfully';
COMMENT ON COLUMN telegram_notifications_log.sent_at IS 'Timestamp when notification was attempted';
