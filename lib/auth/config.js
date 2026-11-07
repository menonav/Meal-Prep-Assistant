// Only variable names and validation results leave this module, never values.
export function authConfigurationIssue(env = process.env) {
  if (!env.NEON_AUTH_BASE_URL) return "NEON_AUTH_BASE_URL is missing.";
  try {
    const url = new URL(env.NEON_AUTH_BASE_URL);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
      return "NEON_AUTH_BASE_URL must be the HTTPS endpoint from Neon Auth.";
    }
  } catch {
    return "NEON_AUTH_BASE_URL must be the HTTPS endpoint from Neon Auth.";
  }
  if (!env.NEON_AUTH_COOKIE_SECRET || env.NEON_AUTH_COOKIE_SECRET.length < 32) {
    return "NEON_AUTH_COOKIE_SECRET must contain at least 32 random characters.";
  }
  return null;
}
