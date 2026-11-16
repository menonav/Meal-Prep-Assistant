import { NextResponse } from "next/server";
import { getAuth } from "../../../lib/auth/server";
import { hasPremiumAccess, readFoodPreferences, saveFoodPreferences } from "../../../lib/app-data";
import { normalizeFoodPreferences } from "../../../lib/food-preferences";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(error, status) {
  return NextResponse.json({ error }, { status });
}

async function handle(request, write) {
  try {
    const { data, error } = await getAuth().getSession({ query: { disableCookieCache: "true" } });
    if (error) return fail("Could not verify your session.", 503);
    if (!data?.user?.id) return fail("Please log in again.", 401);
    if (!(await hasPremiumAccess(data.user))) return fail("Saved food preferences are included with Plus.", 402);
    if (!write) return NextResponse.json({ preferences: await readFoodPreferences(data.user.id) });

    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
      return fail("Send your food preferences as JSON.", 415);
    }
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 16_000) return fail("These preferences are too long.", 413);

    let preferences;
    try {
      preferences = normalizeFoodPreferences(JSON.parse(raw));
    } catch {
      return fail("Could not read your food preferences.", 400);
    }
    if (!preferences) return fail("Use up to 12 entries per list, 80 characters per entry, and 5–240 minutes.", 400);
    await saveFoodPreferences(data.user.id, preferences);
    return NextResponse.json({ preferences });
  } catch {
    return fail("Food preferences are temporarily unavailable. Try again.", 503);
  }
}

export const GET = (request) => handle(request, false);
export const PUT = (request) => handle(request, true);
