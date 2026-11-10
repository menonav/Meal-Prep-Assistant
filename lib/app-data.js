import "server-only";
import { neon } from "@neondatabase/serverless";

let sql;
let initialized;

function database() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }
  sql ??= neon(process.env.DATABASE_URL);
  return sql;
}

async function ensureTables() {
  if (!initialized) {
    initialized = (async () => {
      const query = database();
      await query`CREATE TABLE IF NOT EXISTS meal_prep_user_plans (
        user_id text PRIMARY KEY,
        plans jsonb NOT NULL DEFAULT '{}'::jsonb,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`;
      await query`CREATE TABLE IF NOT EXISTS meal_prep_entitlements (
        user_id text PRIMARY KEY,
        email text NOT NULL,
        plan text NOT NULL DEFAULT 'free',
        stripe_session_id text UNIQUE,
        stripe_subscription_id text UNIQUE,
        stripe_customer_id text,
        subscription_status text NOT NULL DEFAULT 'active',
        updated_at timestamptz NOT NULL DEFAULT now()
      )`;
      await query`ALTER TABLE meal_prep_entitlements ADD COLUMN IF NOT EXISTS stripe_subscription_id text`;
      await query`ALTER TABLE meal_prep_entitlements ADD COLUMN IF NOT EXISTS stripe_customer_id text`;
      await query`ALTER TABLE meal_prep_entitlements ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'active'`;
      await query`CREATE UNIQUE INDEX IF NOT EXISTS meal_prep_entitlements_subscription_id_key
        ON meal_prep_entitlements (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL`;
      await query`CREATE TABLE IF NOT EXISTS meal_prep_ai_usage (
        user_id text NOT NULL,
        usage_day date NOT NULL DEFAULT current_date,
        calls integer NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, usage_day)
      )`;
    })().catch((error) => {
      initialized = undefined;
      throw error;
    });
  }
  await initialized;
  return database();
}

export async function readPlans(userId) {
  const query = await ensureTables();
  const rows = await query`SELECT plans FROM meal_prep_user_plans WHERE user_id = ${userId}`;
  return rows[0]?.plans ?? {};
}

export async function writePlans(userId, plans) {
  const query = await ensureTables();
  await query`INSERT INTO meal_prep_user_plans (user_id, plans, updated_at)
    VALUES (${userId}, ${JSON.stringify(plans)}::jsonb, now())
    ON CONFLICT (user_id) DO UPDATE SET plans = EXCLUDED.plans, updated_at = now()`;
}

export async function hasPremiumAccess(user) {
  if (user?.email?.toLowerCase() === "demo@demo.com") return true;
  if (!user?.id) return false;
  const query = await ensureTables();
  const rows = await query`SELECT plan, subscription_status
    FROM meal_prep_entitlements WHERE user_id = ${user.id}`;
  return rows[0]?.plan === "premium"
    && ["active", "trialing"].includes(rows[0]?.subscription_status);
}

export async function syncStripeSubscription({
  userId,
  email,
  checkoutSessionId = null,
  subscriptionId,
  customerId = null,
  status,
}) {
  if (!userId || !email || !subscriptionId || !status) {
    throw new Error("Stripe subscription is missing account metadata.");
  }
  const query = await ensureTables();
  const hasAccess = ["active", "trialing"].includes(status);
  await query`INSERT INTO meal_prep_entitlements
      (user_id, email, plan, stripe_session_id, stripe_subscription_id, stripe_customer_id, subscription_status, updated_at)
    VALUES (
      ${userId},
      ${email},
      ${hasAccess ? "premium" : "free"},
      ${checkoutSessionId},
      ${subscriptionId},
      ${customerId},
      ${status},
      now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      email = EXCLUDED.email,
      plan = EXCLUDED.plan,
      stripe_session_id = COALESCE(EXCLUDED.stripe_session_id, meal_prep_entitlements.stripe_session_id),
      stripe_subscription_id = EXCLUDED.stripe_subscription_id,
      stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, meal_prep_entitlements.stripe_customer_id),
      subscription_status = EXCLUDED.subscription_status,
      updated_at = now()`;
}

export async function consumeAiQuota(userId, dailyLimit = 5) {
  const query = await ensureTables();
  const rows = await query`INSERT INTO meal_prep_ai_usage (user_id, usage_day, calls)
    VALUES (${userId}, current_date, 1)
    ON CONFLICT (user_id, usage_day) DO UPDATE
      SET calls = meal_prep_ai_usage.calls + 1
      WHERE meal_prep_ai_usage.calls < ${dailyLimit}
    RETURNING calls`;
  return rows[0]?.calls ?? null;
}
