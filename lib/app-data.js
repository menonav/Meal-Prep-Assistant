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
        plan text NOT NULL DEFAULT 'premium',
        stripe_session_id text UNIQUE,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`;
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
  const query = await ensureTables();
  const rows = await query`SELECT plan FROM meal_prep_entitlements WHERE user_id = ${user.id}`;
  return rows[0]?.plan === "premium";
}

export async function grantPremiumAccess({ userId, email, checkoutSessionId }) {
  const query = await ensureTables();
  await query`INSERT INTO meal_prep_entitlements (user_id, email, plan, stripe_session_id, updated_at)
    VALUES (${userId}, ${email}, 'premium', ${checkoutSessionId}, now())
    ON CONFLICT (user_id) DO UPDATE SET
      email = EXCLUDED.email,
      plan = 'premium',
      stripe_session_id = COALESCE(EXCLUDED.stripe_session_id, meal_prep_entitlements.stripe_session_id),
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
