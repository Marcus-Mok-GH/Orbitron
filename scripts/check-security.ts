import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import express from "express";
import { generateKeyPair, exportJWK, SignJWT } from "jose";

process.env.DATABASE_URL = "postgresql://test:test@localhost/test";
const { privateKey, publicKey } = await generateKeyPair("RS256");
const jwk = {
  ...(await exportJWK(publicKey)),
  kid: "security-test",
  alg: "RS256",
};
const jwksApp = express();
jwksApp.get("/jwks", (_req, res) => res.json({ keys: [jwk] }));
const jwksServer = jwksApp.listen(0, "127.0.0.1");
await new Promise<void>((resolve) => jwksServer.once("listening", resolve));
process.env.NEON_AUTH_JWKS_URL = `http://127.0.0.1:${(jwksServer.address() as { port: number }).port}/jwks`;
const owner = randomUUID(),
  other = randomUUID();
const token = await new SignJWT({ email: "test@example.invalid", name: "Test" })
  .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
  .setSubject(owner)
  .setIssuedAt()
  .setExpirationTime("5m")
  .sign(privateKey);
const key = "sk-sb-v1-security-test";
const identity = new Set([owner, other]);
let deleted = false,
  failDelete = false,
  rolledBack = false;
const calls: string[] = [];
const sessionId = randomUUID();
const { pool } = await import("../server/db");
(pool as any).query = async (sql: string, params: any[] = []) => {
  if (sql.startsWith('SELECT id FROM neon_auth."user"'))
    return { rows: identity.has(params[0]) ? [{ id: params[0] }] : [] };
  if (sql.includes("INSERT INTO users"))
    return {
      rows: [
        {
          id: params[0],
          email: "test@example.invalid",
          first_name: "Test",
          last_name: null,
          profile_image_url: null,
        },
      ],
    };
  if (sql.includes("FROM neon_auth.session")) {
    assert.ok(sql.includes('WHERE "userId" = $1::uuid'));
    assert.ok(sql.includes('"expiresAt" > NOW()'));
    assert.equal(params[0], owner);
    return {
      rows: [
        {
          id: sessionId,
          createdAt: new Date(),
          updatedAt: new Date(),
          expiresAt: new Date(Date.now() + 60_000),
          userAgent: "Mozilla/5.0 Chrome/120.0.0.0",
          ipAddress: "127.0.0.1",
        },
      ],
    };
  }
  if (sql.includes("JOIN users")) {
    assert.equal(params[0], createHash("sha256").update(key).digest("hex"));
    return { rows: [{ id: owner, key_id: "api-key", revoked_at: null }] };
  }
  if (sql.startsWith("UPDATE api_keys")) return { rows: [] };
  throw new Error("Unexpected SQL: " + sql.slice(0, 80));
};
(pool as any).connect = async () => ({
  query: async (sql: string, params: any[] = []) => {
    calls.push(sql);
    if (params.length) assert.equal(params[0], owner);
    if (sql === "BEGIN") return { rows: [] };
    if (sql === "ROLLBACK") {
      rolledBack = true;
      return { rows: [] };
    }
    if (sql.includes('DELETE FROM neon_auth."user"') && failDelete)
      throw new Error("Simulated transaction failure");
    if (sql === "COMMIT") {
      identity.delete(owner);
      deleted = true;
    }
    return { rows: [] };
  },
  release() {
    calls.push("release");
  },
});
const { registerAuthRoutes } = await import("../server/authRoutes");
const { registerApiRoutes } = await import("../server/api");
const app = express();
app.use(express.json());
registerAuthRoutes(app);
registerApiRoutes(app);
const server = app.listen(0, "127.0.0.1");
await new Promise<void>((resolve) => server.once("listening", resolve));
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
const call = (
  path: string,
  options: { token?: string | null; origin?: string; body?: unknown } = {},
) =>
  fetch(base + path, {
    method: options.body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token === null
        ? {}
        : { Authorization: "Bearer " + (options.token ?? token) }),
      Origin: options.origin ?? base,
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
try {
  assert.equal((await call("/api/auth/sessions", { token: null })).status, 401);
  assert.equal(
    (await call("/api/auth/sessions", { token: "invalid" })).status,
    401,
  );
  const sessions = await call("/api/auth/sessions");
  assert.equal(sessions.status, 200);
  assert.equal(sessions.headers.get("cache-control"), "no-store");
  const listed = (await sessions.json()).data;
  assert.equal(listed[0].id, sessionId);
  assert.equal("token" in listed[0], false);
  assert.equal("current" in listed[0], false);
  assert.ok(listed[0].device);
  const path = "/api/account/delete",
    body = { confirm: "delete my account" };
  assert.equal((await call(path, { body, token: key })).status, 403);
  assert.equal(
    (await call(path, { body, origin: "https://attacker.invalid" })).status,
    403,
  );
  assert.equal((await call(path, { body: { confirm: "wrong" } })).status, 400);
  assert.equal(deleted, false);
  failDelete = true;
  assert.equal((await call(path, { body })).status, 500);
  assert.equal(rolledBack, true);
  assert.equal(deleted, false);
  assert.ok(identity.has(owner));
  failDelete = false;
  assert.equal((await call(path, { body })).status, 204);
  assert.ok(
    calls.includes('DELETE FROM neon_auth.session WHERE "userId" = $1::uuid'),
  );
  assert.ok(
    calls.includes('DELETE FROM neon_auth.account WHERE "userId" = $1::uuid'),
  );
  assert.ok(calls.includes('DELETE FROM neon_auth."user" WHERE id = $1::uuid'));
  assert.ok(calls.includes("DELETE FROM public.users WHERE id = $1"));
  assert.equal(deleted, true);
  assert.ok(identity.has(other));
  assert.equal((await call("/api/auth/sessions")).status, 401);
  console.log(
    "Security integration checks passed: authentication, user-scoped sessions, no token leakage, deletion guards, transaction rollback, identity deletion and old-JWT rejection.",
  );
} finally {
  server.close();
  jwksServer.close();
  await pool.end();
}
