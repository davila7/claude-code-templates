-- Subscriptions and pricing tables
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL UNIQUE,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'team', 'enterprise')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  ai_generations_used INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscription limits based on tier
CREATE TABLE IF NOT EXISTS subscription_limits (
  tier TEXT PRIMARY KEY CHECK (tier IN ('free', 'pro', 'team', 'enterprise')),
  ai_generations_per_month INTEGER NOT NULL,
  private_collections INTEGER NOT NULL,
  team_members INTEGER NOT NULL,
  custom_training BOOLEAN DEFAULT FALSE,
  priority_support BOOLEAN DEFAULT FALSE,
  api_access BOOLEAN DEFAULT FALSE
);

-- Insert default limits
INSERT INTO subscription_limits (tier, ai_generations_per_month, private_collections, team_members, custom_training, priority_support, api_access)
VALUES
  ('free', 5, 3, 1, FALSE, FALSE, FALSE),
  ('pro', 100, -1, 1, FALSE, TRUE, FALSE),
  ('team', 500, -1, 10, TRUE, TRUE, TRUE),
  ('enterprise', -1, -1, -1, TRUE, TRUE, TRUE)
ON CONFLICT (tier) DO NOTHING;

-- Usage tracking
CREATE TABLE IF NOT EXISTS ai_generation_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL,
  generation_id UUID REFERENCES ai_generations(id),
  tokens_used INTEGER NOT NULL,
  cost_cents INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_clerk_user_id ON user_subscriptions(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_customer_id ON user_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_subscription_id ON user_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_ai_generation_usage_clerk_user_id ON ai_generation_usage(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_ai_generation_usage_created_at ON ai_generation_usage(created_at);

-- Function to reset monthly usage
CREATE OR REPLACE FUNCTION reset_monthly_ai_usage()
RETURNS void AS $$
BEGIN
  UPDATE user_subscriptions
  SET ai_generations_used = 0
  WHERE current_period_end < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to check if user can generate
CREATE OR REPLACE FUNCTION can_user_generate(user_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_tier TEXT;
  user_usage INTEGER;
  tier_limit INTEGER;
BEGIN
  SELECT tier, ai_generations_used INTO user_tier, user_usage
  FROM user_subscriptions
  WHERE clerk_user_id = user_id;

  IF NOT FOUND THEN
    -- User doesn't have subscription, use free tier
    user_tier := 'free';
    user_usage := 0;
  END IF;

  SELECT ai_generations_per_month INTO tier_limit
  FROM subscription_limits
  WHERE tier = user_tier;

  -- -1 means unlimited
  IF tier_limit = -1 THEN
    RETURN TRUE;
  END IF;

  RETURN user_usage < tier_limit;
END;
$$ LANGUAGE plpgsql;
