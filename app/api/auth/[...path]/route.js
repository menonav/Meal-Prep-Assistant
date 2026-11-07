import { getAuth } from "../../../../lib/auth/server";
import { authConfigurationIssue } from "../../../../lib/auth/config";

export const dynamic = "force-dynamic";

async function handle(request, context) {
  if (authConfigurationIssue()) {
    return Response.json(
      { message: "Account access is not configured yet. Please try again later." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  // The SDK handles cookie signing, forwarding, expiry, and sign-out cleanup.
  const response = await getAuth().handler()[request.method](request, context);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const GET = handle;
export const POST = handle;
