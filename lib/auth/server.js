import "server-only";
import { createNeonAuth } from "@neondatabase/auth/next/server";
import { getAuthConfiguration } from "./config";

let auth;

// Lazy initialization lets the public homepage build without runtime secrets.
export function getAuth() {
  const config = getAuthConfiguration();
  if (config.issue) throw new Error(config.issue);
  auth ??= createNeonAuth({
    baseUrl: config.baseUrl,
    cookies: {
      secret: config.secret,
      sessionDataTtl: 60,
    },
  });
  return auth;
}
