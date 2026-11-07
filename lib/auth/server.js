import "server-only";
import { createNeonAuth } from "@neondatabase/auth/next/server";
import { authConfigurationIssue } from "./config";

let auth;

// Lazy initialization lets the public homepage build without runtime secrets.
export function getAuth() {
  const issue = authConfigurationIssue();
  if (issue) throw new Error(issue);
  auth ??= createNeonAuth({
    baseUrl: process.env.NEON_AUTH_BASE_URL,
    cookies: {
      secret: process.env.NEON_AUTH_COOKIE_SECRET,
      sessionDataTtl: 60,
    },
  });
  return auth;
}
