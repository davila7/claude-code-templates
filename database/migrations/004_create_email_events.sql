-- Email engagement events (opens, clicks, bounces, complaints) received from
-- Resend webhooks by the aitmpl-newsletter worker. Aggregated per campaign
-- via the worker's GET /stats endpoint.
CREATE TABLE IF NOT EXISTS email_events (
  id BIGSERIAL PRIMARY KEY,
  resend_email_id TEXT,
  recipient TEXT,
  event_type TEXT NOT NULL,
  url TEXT,
  campaign TEXT,
  occurred_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_events_campaign
  ON email_events(campaign, event_type);

CREATE INDEX IF NOT EXISTS idx_email_events_recipient
  ON email_events(recipient);
