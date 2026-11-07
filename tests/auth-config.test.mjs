import { test } from "node:test";
import assert from "node:assert/strict";
import { authConfigurationIssue } from "../lib/auth/config.js";

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

test("rejects database URLs, insecure endpoints, and embedded credentials without exposing values", () => {
  for (const url of ["postgresql://user:private-password@host/db", "http://host/auth", "invalid", "https://user:private-password@host/auth", "https://host/auth?secret=private-password"]) {
    const issue = authConfigurationIssue({ ...valid, NEON_AUTH_BASE_URL: url });
    assert.match(issue, /HTTPS/);
    assert.ok(!issue.includes("private-password"));
  }
});
