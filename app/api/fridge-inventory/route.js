import { NextResponse } from "next/server";
import { getAuth } from "../../../lib/auth/server";
import { addFridgeItem, deleteFridgeItem, hasPremiumAccess, readFridgeItems, updateFridgeItem } from "../../../lib/app-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function fail(message, status) {
  return NextResponse.json({ error: message }, { status });
}

function validDate(date) {
  if (typeof date !== "string" || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(date);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

async function handle(request, method) {
  try {
    const { data, error } = await getAuth().getSession({ query: { disableCookieCache: "true" } });
    if (error) return fail("Could not verify your session.", 503);
    if (!data?.user?.id) return fail("Please log in again.", 401);
    if (!(await hasPremiumAccess(data.user))) return fail("Fridge inventory is included with Meal Prep Assistant Plus.", 402);
    const userId = data.user.id;
    if (method === "GET") return NextResponse.json({ items: await readFridgeItems(userId) });

    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
      return fail("Send the fridge item as JSON.", 415);
    }
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 4096) return fail("This item is too large.", 413);
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return fail("Could not read the fridge item.", 400);
    }
    if (!body || typeof body !== "object") return fail("Could not read the fridge item.", 400);
    if (method !== "POST" && (typeof body.id !== "string" || !UUID.test(body.id))) {
      return fail("Choose a fridge item.", 400);
    }
    if (method === "DELETE") {
      if (!(await deleteFridgeItem(userId, body.id))) return fail("That fridge item no longer exists.", 404);
      return NextResponse.json({ ok: true });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const expiryDate = body.expiryDate === "" || body.expiryDate == null ? null : body.expiryDate;
    if (!name || name.length > 120) return fail("Enter an ingredient name up to 120 characters.", 400);
    if (expiryDate !== null && !validDate(expiryDate)) return fail("Enter a valid expiry date.", 400);

    const item = method === "POST"
      ? await addFridgeItem(userId, { name, expiryDate })
      : await updateFridgeItem(userId, { id: body.id, name, expiryDate });
    if (!item) return fail("That fridge item no longer exists.", 404);
    return NextResponse.json({ item });
  } catch (error) {
    if (error?.code === "23505") return fail("That ingredient is already in your fridge list.", 409);
    return fail("Your fridge list is temporarily unavailable. Try again.", 503);
  }
}

export const GET = (request) => handle(request, "GET");
export const POST = (request) => handle(request, "POST");
export const PATCH = (request) => handle(request, "PATCH");
export const DELETE = (request) => handle(request, "DELETE");
