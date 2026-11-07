import { NextResponse } from "next/server";
import { getAuth } from "./lib/auth/server";
import { authConfigurationIssue } from "./lib/auth/config";

export default async function proxy(request) {
  if (authConfigurationIssue()) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return getAuth().middleware({ loginUrl: "/login" })(request);
}

export const config = { matcher: ["/dashboard/:path*"] };
