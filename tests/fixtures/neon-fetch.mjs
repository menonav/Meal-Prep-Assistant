// Test-only upstream substitute. Never imported by the application.
// Exercises the real SDK's proxy/cookies without contacting or modifying Neon.
import { randomUUID } from "node:crypto";

const originalFetch = globalThis.fetch;
const users = new Map();
const sessions = new Map();
const tokenName = "__Secure-neon-auth.session_token";

globalThis.fetch = async (input, options = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url || input.href);
  if (url.hostname !== "neon.test.invalid") return originalFetch(input, options);
  const request = new Request(input, options);
  const headers = new Headers({ "Content-Type": "application/json" });
  const reply = (body, status = 200) => Response.json(body, { status, headers });
  if (!url.pathname.startsWith("/auth/") || url.pathname.includes("//")) {
    return reply({ message: "Invalid test endpoint path" }, 404);
  }
  const token = request.headers.get("cookie")?.split("; ").find((part) => part.startsWith(`${tokenName}=`))?.slice(tokenName.length + 1);

  if (url.pathname.endsWith("/get-session")) {
    return reply(sessions.get(token) || null);
  }
  if (url.pathname.endsWith("/sign-out")) {
    sessions.delete(token);
    headers.append("Set-Cookie", `${tokenName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
    return reply({ success: true });
  }
  if (url.pathname.endsWith("/sign-up/email") || url.pathname.endsWith("/sign-in/email")) {
    const body = await request.json();
    const signup = url.pathname.endsWith("/sign-up/email");
    if (signup) {
      if (users.has(body.email)) return reply({ message: "Account exists" }, 422);
      users.set(body.email, { password: body.password, user: { id: randomUUID(), name: body.name, email: body.email, emailVerified: true, image: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } });
    }
    const account = users.get(body.email);
    if (!account || account.password !== body.password) return reply({ message: "Invalid credentials" }, 401);
    const newToken = randomUUID();
    const session = { id: randomUUID(), userId: account.user.id, token: newToken, expiresAt: new Date(Date.now() + 86400000).toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    sessions.set(newToken, { session, user: account.user });
    headers.append("Set-Cookie", `${tokenName}=${newToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`);
    return reply({ token: newToken, user: account.user, redirect: false });
  }
  return reply({ message: "Unknown test endpoint" }, 404);
};
