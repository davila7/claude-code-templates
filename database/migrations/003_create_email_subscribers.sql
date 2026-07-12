-- Newsletter subscribers (source of truth: Clerk; this table drives sends
-- and owns unsubscribe state for the aitmpl-newsletter worker).
CREATE TABLE IF NOT EXISTS email_subscribers (
  id SERIAL PRIMARY KEY,
  clerk_user_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(320) NOT NULL,
  unsubscribe_token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_subscribers_token
  ON email_subscribers(unsubscribe_token);

-- Partial index for the send query: active subscribers pending this campaign
CREATE INDEX IF NOT EXISTS idx_email_subscribers_pending
  ON email_subscribers(last_sent_at)
  WHERE unsubscribed_at IS NULL;
