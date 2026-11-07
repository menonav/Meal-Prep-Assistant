// Use explicit server-side reads. Do not serialize this object or log its values.
function authEnvironment() {
  return {
    NEON_AUTH_BASE_URL: process.env.NEON_AUTH_BASE_URL,
    NEON_AUTH_COOKIE_SECRET: process.env.NEON_AUTH_COOKIE_SECRET,
  };
}

// Resolve once so page availability and the server SDK cannot disagree.
export function resolveAuthConfiguration(env) {
  const baseUrl = typeof env.NEON_AUTH_BASE_URL === "string"
    ? env.NEON_AUTH_BASE_URL.trim().replace(/\/+$/, "") : "";
  const secret = env.NEON_AUTH_COOKIE_SECRET;
  const failure = (code, issue) => ({ code, issue });

  if (!baseUrl) return failure("AUTH_URL_MISSING", "NEON_AUTH_BASE_URL is missing.");
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
      return failure("AUTH_URL_INVALID", "NEON_AUTH_BASE_URL must be the HTTPS endpoint from Neon Auth, without credentials, query parameters, or a fragment.");
    }
  } catch {
    return failure("AUTH_URL_INVALID", "NEON_AUTH_BASE_URL must be the HTTPS endpoint from Neon Auth.");
  }
  if (!secret) return failure("COOKIE_SECRET_MISSING", "NEON_AUTH_COOKIE_SECRET is missing.");
  if (typeof secret !== "string" || secret.trim().length < 32) {
    return failure("COOKIE_SECRET_TOO_SHORT", "NEON_AUTH_COOKIE_SECRET must contain at least 32 random characters, excluding surrounding whitespace.");
  }
  // Preserve the secret exactly; normalization must not change cookie signatures.
  return { code: "CONFIGURED", issue: null, baseUrl, secret };
}

const reportedStates = new Set();

export function getAuthConfiguration() {
  const config = resolveAuthConfiguration(authEnvironment());
  if (!reportedStates.has(config.code)) {
    reportedStates.add(config.code);
    // Fixed codes/names only: never log process.env, the URL, or the secret.
    if (config.issue) console.error(`[auth-config] ${config.code}: ${config.issue}`);
    else console.info("[auth-config] CONFIGURED");
  }
  return config;
}

export function authConfigurationIssue(env) {
  return (env === undefined ? getAuthConfiguration() : resolveAuthConfiguration(env)).issue;
}
