import { test } from "node:test";
import assert from "node:assert/strict";
import { authConfigurationIssue, resolveAuthConfiguration, getAuthConfiguration } from "../lib/auth/config.js";

const valid = {
  NEON_AUTH_BASE_URL: "https://example.neonauth.us-east-1.aws.neon.tech/db/auth",
  NEON_AUTH_COOKIE_SECRET: "test-only-value-that-is-at-least-32-characters",
};

test("requires a Neon Auth URL and a sufficiently long cookie secret", () => {
  assert.match(authConfigurationIssue({}), /NEON_AUTH_BASE_URL/);
  assert.match(authConfigurationIssue({ NEON_AUTH_BASE_URL: valid.NEON_AUTH_BASE_URL }), /NEON_AUTH_COOKIE_SECRET/);
  assert.match(authConfigurationIssue({ ...valid, NEON_AUTH_COOKIE_SECRET: "short" }), /32/);
  assert.equal(authConfigurationIssue(valid), null);
});

test("normalizes URL whitespace and trailing slashes for validation and SDK initialization", () => {
  const config = resolveAuthConfiguration({ ...valid, NEON_AUTH_BASE_URL: `  ${valid.NEON_AUTH_BASE_URL}/\n` });
  assert.equal(config.issue, null);
  assert.equal(config.baseUrl, valid.NEON_AUTH_BASE_URL);
  assert.equal(config.secret, valid.NEON_AUTH_COOKIE_SECRET);
});

test("reports distinct, value-free failures and rejects whitespace-only secrets", () => {
  assert.equal(resolveAuthConfiguration({}).code, "AUTH_URL_MISSING");
  assert.equal(resolveAuthConfiguration({ NEON_AUTH_BASE_URL: valid.NEON_AUTH_BASE_URL }).code, "COOKIE_SECRET_MISSING");
  const config = resolveAuthConfiguration({ ...valid, NEON_AUTH_COOKIE_SECRET: " ".repeat(40) });
  assert.equal(config.code, "COOKIE_SECRET_TOO_SHORT");
  assert.equal("secret" in config, false);
  assert.equal("baseUrl" in config, false);
});

test("rejects database URLs, insecure endpoints, and embedded credentials without exposing values", () => {
  for (const url of ["postgresql://user:private-password@host/db", "http://host/auth", "invalid", "https://user:private-password@host/auth", "https://host/auth?secret=private-password"]) {
    const issue = authConfigurationIssue({ ...valid, NEON_AUTH_BASE_URL: url });
    assert.match(issue, /HTTPS/);
    assert.ok(!issue.includes("private-password"));
  }
});

test("runtime diagnostics report only fixed codes and names, never environment values", () => {
  const names = ["NEON_AUTH_BASE_URL", "NEON_AUTH_COOKIE_SECRET"];
  const before = names.map((name) => process.env[name]);
  const oldError = console.error;
  const oldInfo = console.info;
  const messages = [];
  console.error = (...args) => messages.push(args.join(" "));
  console.info = (...args) => messages.push(args.join(" "));
  try {
    process.env.NEON_AUTH_BASE_URL = "https://test.example/auth?private=test-only-sentinel";
    process.env.NEON_AUTH_COOKIE_SECRET = valid.NEON_AUTH_COOKIE_SECRET;
    assert.equal(getAuthConfiguration().code, "AUTH_URL_INVALID");
    process.env.NEON_AUTH_BASE_URL = valid.NEON_AUTH_BASE_URL;
    assert.equal(getAuthConfiguration().code, "CONFIGURED");
    assert.equal(messages.length, 2);
    assert.ok(messages.some((message) => message.includes("[auth-config] AUTH_URL_INVALID")));
    assert.ok(messages.includes("[auth-config] CONFIGURED"));
    for (const message of messages) {
      assert.ok(!message.includes("test-only-sentinel"));
      assert.ok(!message.includes(valid.NEON_AUTH_BASE_URL));
      assert.ok(!message.includes(valid.NEON_AUTH_COOKIE_SECRET));
    }
  } finally {
    console.error = oldError;
    console.info = oldInfo;
    names.forEach((name, i) => {
      if (before[i] === undefined) delete process.env[name];
      else process.env[name] = before[i];
    });
  }
});
