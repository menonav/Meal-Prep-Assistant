import { NextResponse } from "next/server";
import { getAuth } from "../../../lib/auth/server";
import { readPlans, writePlans } from "../../../lib/app-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function currentUser() {
  try {
    const { data, error } = await getAuth().getSession({ query: { disableCookieCache: "true" } });
    if (error) return { error: NextResponse.json({ error: "Could not verify your session." }, { status: 503 }) };
    if (!data?.user?.id) return { error: NextResponse.json({ error: "Please log in again." }, { status: 401 }) };
    return { user: data.user };
  } catch {
    return { error: NextResponse.json({ error: "Account access is temporarily unavailable." }, { status: 503 }) };
  }
}

export async function GET() {
  const { user, error } = await currentUser();
  if (error) return error;
  try {
    return NextResponse.json({ plans: await readPlans(user.id) });
  } catch {
    return NextResponse.json({ error: "Planner sync is not configured yet." }, { status: 503 });
  }
}

export async function PUT(request) {
  const { user, error } = await currentUser();
  if (error) return error;
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 256_000) return NextResponse.json({ error: "This plan is too large to save." }, { status: 413 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "The planner data is invalid." }, { status: 400 });
  }
  if (!body || typeof body.plans !== "object" || Array.isArray(body.plans) || JSON.stringify(body.plans).length > 256_000) {
    return NextResponse.json({ error: "The planner data is invalid or too large." }, { status: 400 });
  }

  try {
    await writePlans(user.id, body.plans);
    return NextResponse.json({ saved: true });
  } catch {
    return NextResponse.json({ error: "Planner sync is not configured yet." }, { status: 503 });
  }
}
