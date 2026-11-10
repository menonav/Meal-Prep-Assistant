-- Run once against the Neon application database before enabling Stripe webhooks.
-- This table stores billing references only; Neon Auth remains the source of user identity.
CREATE TABLE IF NOT EXISTS app_billing_customers (
  user_id TEXT PRIMARY KEY,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  subscription_id TEXT,
  subscription_status TEXT,
  price_id TEXT,
  current_period_end TIMESTAMPTZ,
  last_event_created BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS app_billing_customers_subscription_status_idx
  ON app_billing_customers (subscription_status);
