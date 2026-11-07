import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout } from "node:timers/promises";

async function start(t, port, configured) {
  const env = { ...process.env, NEON_AUTH_BASE_URL: "", NEON_AUTH_COOKIE_SECRET: "", NEXT_TELEMETRY_DISABLED: "1" };
  if (configured) {
    env.NEON_AUTH_BASE_URL = "https://neon.test.invalid/auth";
    env.NEON_AUTH_COOKIE_SECRET = "test-only-secret-for-http-integration-tests";
  }
  if (configured === "normalized") env.NEON_AUTH_BASE_URL = "  https://neon.test.invalid/auth/  ";
  const server = spawn(process.execPath, ["--import", new URL("./fixtures/neon-fetch.mjs", import.meta.url).href, "node_modules/next/dist/bin/next", "start", "-p", String(port)], { env, stdio: ["ignore", "pipe", "pipe"] });
  let logs = "";
  server.stdout.on("data", (chunk) => { logs += chunk; });
  server.stderr.on("data", (chunk) => { logs += chunk; });
  t.after(async () => {
    if (server.exitCode === null) {
      const exited = new Promise((resolve) => server.once("exit", resolve));
      server.kill();
      await exited;
    }
  });
  const base = `http://localhost:${port}`;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(`Test server exited: ${logs}`);
    try { if ((await fetch(base)).ok) return base; } catch { /* Wait for Next.js. */ }
    await setTimeout(100);
  }
  throw new Error(`Test server did not become ready: ${logs}`);
}

test("missing environment keeps homepage public and fails auth closed", async (t) => {
  const base = await start(t, 3217, false);
  assert.equal((await fetch(base)).status, 200);
  for (const path of ["/login", "/signup"]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Account access is being set up/);
  }
  const dashboard = await fetch(base + "/dashboard", { redirect: "manual" });
  assert.equal(dashboard.status, 307);
  assert.equal(new URL(dashboard.headers.get("location"), base).pathname, "/login");
  const auth = await fetch(base + "/api/auth/get-session");
  assert.equal(auth.status, 503);
  assert.equal(auth.headers.get("cache-control"), "no-store");
});

test("normalized URL enables signup and initializes the actual SDK", async (t) => {
  const base = await start(t, 3219, "normalized");
  const signup = await fetch(base + "/signup");
  assert.equal(signup.status, 200);
  assert.doesNotMatch(await signup.text(), /Account access is being set up/);
  const session = await fetch(base + "/api/auth/get-session");
  assert.equal(session.status, 200);
  assert.equal(await session.json(), null);
});

test("SDK cookie integration: signup, persisted session, login, logout and revoked-cookie replay", async (t) => {
  const base = await start(t, 3218, true);
  async function post(path, body, cookie = "") {
    return fetch(base + "/api/auth/" + path, { method: "POST", headers: { "Content-Type": "application/json", Origin: base, Cookie: cookie }, body: JSON.stringify(body) });
  }
  const credentials = { name: "Test Cook", email: "cook@example.test", password: "test-only-password" };
  const signup = await post("sign-up/email", credentials);
  assert.equal(signup.status, 200);
  const setCookies = signup.headers.getSetCookie();
  assert.ok(setCookies.some((value) => value.includes("session_token=") && /HttpOnly/i.test(value) && /Secure/i.test(value) && /Max-Age=/i.test(value)));
  assert.ok(setCookies.some((value) => value.includes("session_data=")));
  const cookie = setCookies.map((value) => value.split(";")[0]).join("; ");
  assert.equal((await fetch(base + "/dashboard", { redirect: "manual" })).status, 307);
  const dashboard = await fetch(base + "/dashboard", { headers: { Cookie: cookie } });
  assert.equal(dashboard.status, 200);
  assert.match(await dashboard.text(), /cook@example.test/);
  const session = await fetch(base + "/api/auth/get-session", { headers: { Cookie: cookie } });
  assert.equal((await session.json()).user.email, credentials.email);
  assert.equal(session.headers.get("cache-control"), "no-store");
  assert.equal((await post("sign-in/email", { ...credentials, password: "wrong-password" })).status, 401);
  assert.equal((await post("sign-up/email", credentials)).status, 422);
  const logout = await post("sign-out", {}, cookie);
  assert.equal(logout.status, 200);
  assert.ok(logout.headers.getSetCookie().filter((value) => /Max-Age=0/i.test(value)).length >= 2);
  // Replay both the revoked token and its still-signed cache cookie.
  const replay = await fetch(base + "/dashboard", { headers: { Cookie: cookie }, redirect: "manual" });
  assert.equal(replay.status, 307);
  const login = await post("sign-in/email", credentials);
  assert.equal(login.status, 200);
  const loginCookie = login.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
  assert.equal((await fetch(base + "/dashboard", { headers: { Cookie: loginCookie }, redirect: "manual" })).status, 200);
  const forged = await fetch(base + "/dashboard", { headers: { Cookie: "__Secure-neon-auth.session_token=forged; __Secure-neon-auth.local.session_data=forged" }, redirect: "manual" });
  assert.equal(forged.status, 307);
});
