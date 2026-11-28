import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import dns from "node:dns";
import https from "node:https";
import { syncBuiltinESMExports } from "node:module";
import { PassThrough } from "node:stream";
import express from "express";

process.env.DATABASE_URL = "postgresql://test:test@localhost/test";
process.env.BYOK_ENCRYPTION_KEY = "custom-provider-test-key";
const network = await import("../server/providerNetwork");
for (const address of ["127.0.0.1", "10.1.0.2", "169.254.169.254", "100.100.100.200", "192.168.1.1", "::1", "::ffff:127.0.0.1", "fc00::1", "2001:db8::1", "2002:7f00:1::"]) {
  assert.equal(network.isPublicAddress(address), false, address);
}
for (const address of ["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"]) {
  assert.equal(network.isPublicAddress(address), true, address);
}
for (const url of ["http://api.example.com", "https://localhost/v1", "https://127.1", "https://0x7f000001", "https://[::ffff:127.0.0.1]", "https://user:password@example.com", "https://example.com?key=secret"]) {
  assert.throws(() => network.normalizeProviderUrl(url), undefined, url);
}
assert.equal(network.normalizeProviderUrl("https://api.example.com/v1/"), "https://api.example.com/v1");
assert.deepEqual(await network.readModelIds(Response.json({ data: [{ id: "b" }, { id: "a" }, { id: "b" }, {}] })), ["a", "b"]);
await assert.rejects(network.readModelIds(Response.json({ models: [] })), /compatible/);
await assert.rejects(network.readModelIds(Response.json({ data: [] })), /No models/);
await assert.rejects(network.readModelIds(Response.json({ data: [{ id: "a" }], has_more: true })), /paginates/);
await assert.rejects(network.readModelIds(new Response("bad", { status: 401 })), /HTTP 401/);
await assert.rejects(network.readModelIds(new Response("x".repeat(2_000_001))), /too large/);

const originalLookup = dns.promises.lookup;
const originalRequest = https.request;
let upstreamStatus = 200;
let upstreamPayload: unknown = { data: [{ id: "shared/model" }, { id: "second-model" }] };
let upstreamCalls = 0;
let pinnedLookups = 0;
let lastUpstream: { url: string; key: string; body: any } | undefined;
(dns.promises as any).lookup = async (host: string) => [{
  address: host === "private.provider.test" ? "127.0.0.1" : "93.184.216.34", family: 4,
}];
(https as any).request = (url: URL, options: any, callback: any) => {
  upstreamCalls++;
  options.lookup(url.hostname, { all: true }, (error: unknown, addresses: any[]) => {
    assert.equal(error, null);
    assert.equal(addresses[0].address, "93.184.216.34");
    pinnedLookups++;
  });
  const request = new EventEmitter() as any;
  request.setTimeout = () => request;
  request.destroy = (err: Error) => request.emit("error", err);
  request.end = (raw: Buffer | undefined) => {
    lastUpstream = { url: url.toString(), key: options.headers.authorization, body: raw ? JSON.parse(raw.toString()) : null };
    const response = new PassThrough() as any;
    response.statusCode = upstreamStatus;
    response.headers = { "content-type": url.pathname.endsWith("/models") ? "application/json" : "text/event-stream" };
    callback(response);
    if (upstreamStatus !== 200 || url.pathname.endsWith("/models")) response.end(JSON.stringify(upstreamPayload));
    else response.end('data: {"id":"test","choices":[{"index":0,"delta":{"content":"Hello from custom"},"finish_reason":null}]}\n\ndata: [DONE]\n\n');
  };
  return request;
};
syncBuiltinESMExports();

const { pool } = await import("../server/db");
const rows: any[] = [];
const usage: any[][] = [];
const ownerToken = "sk-sb-v1-owner-test", otherToken = "sk-sb-v1-other-test";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
(pool as any).query = async (sql: string, params: any[] = []) => {
  if (sql.includes("JOIN users")) {
    const user = params[0] === hash(ownerToken) ? "owner" : params[0] === hash(otherToken) ? "other" : null;
    return { rows: user ? [{ id: user, email: null, key_id: user + "-key", revoked_at: null }] : [] };
  }
  if (sql.startsWith("UPDATE api_keys")) return { rows: [] };
  if (sql.startsWith("SELECT count(*)")) return { rows: [{ count: String(rows.filter((row) => row.user_id === params[0]).length) }] };
  if (sql.startsWith("INSERT INTO custom_providers")) {
    const row = { id: randomUUID(), user_id: params[0], name: params[1], base_url: params[2], encrypted_key: params[3], models: JSON.parse(params[4]) };
    rows.push(row);
    return { rows: [row] };
  }
  if (sql.startsWith("SELECT * FROM custom_providers")) return { rows: rows.filter((row) => row.id === params[0] && row.user_id === params[1]) };
  if (sql.startsWith("SELECT id, name")) return { rows: rows.filter((row) => row.user_id === params[0]) };
  if (sql.startsWith("UPDATE custom_providers")) {
    const row = rows.find((row) => row.id === params[4] && row.user_id === params[5]);
    if (!row) return { rows: [] };
    Object.assign(row, { name: params[0], base_url: params[1], encrypted_key: params[2], models: JSON.parse(params[3]) });
    return { rows: [row] };
  }
  if (sql.startsWith("DELETE FROM custom_providers")) {
    const index = rows.findIndex((row) => row.id === params[0] && row.user_id === params[1]);
    if (index !== -1) rows.splice(index, 1);
    return { rows: [] };
  }
  if (sql.includes("INSERT INTO usage_events")) { usage.push(params); return { rows: [] }; }
  throw new Error("Unexpected database operation: " + sql.slice(0, 60));
};
const { registerCustomProviderRoutes, encryptProviderKey, decryptProviderKey } = await import("../server/customProviders");
const encrypted = encryptProviderKey("secret-key", "owner");
assert.equal(encrypted.includes("secret-key"), false);
assert.equal(decryptProviderKey(encrypted, "owner"), "secret-key");
assert.throws(() => decryptProviderKey(encrypted, "other"));
assert.throws(() => decryptProviderKey(encrypted.slice(0, -5) + "abcde", "owner"));

const app = express();
app.use(express.json());
registerCustomProviderRoutes(app);
const server = app.listen(0, "127.0.0.1");
await new Promise<void>((resolve) => server.once("listening", resolve));
const address = server.address() as { port: number };
const call = (path: string, method = "GET", body?: unknown, token: string | null = ownerToken) =>
  fetch("http://127.0.0.1:" + address.port + "/api/custom-providers" + path, {
    method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

try {
  assert.equal((await call("", "GET", undefined, null)).status, 401);
  assert.equal((await call("", "POST", { name: "Missing fields" })).status, 400);
  const details = { name: "My provider", baseUrl: "https://api.provider.test/v1/", apiKey: "secret-key", models: ["shared/model", "second-model"] };
  let response = await call("", "POST", details);
  assert.equal(response.status, 201);
  const saved = (await response.json()).data;
  assert.equal(saved.apiKey, undefined);
  assert.equal(saved.encrypted_key, undefined);
  assert.equal(saved.baseUrl, "https://api.provider.test/v1");
  assert.notEqual(rows[0].encrypted_key, details.apiKey);
  assert.equal(JSON.stringify(await (await call("")).json()).includes("secret-key"), false);
  assert.equal((await (await call("", "GET", undefined, otherToken)).json()).data.length, 0);
  for (const method of ["PUT", "DELETE"]) assert.equal((await call("/" + saved.id, method, details, otherToken)).status, 404);
  assert.equal((await call("/" + saved.id + "/chat", "POST", { modelId: "shared/model", messages: [{ role: "user", content: "Hi" }] }, otherToken)).status, 404);
  const { apiKey, ...withoutKey } = details;
  response = await call("/" + saved.id, "PUT", { ...withoutKey, name: "Renamed" });
  assert.equal(response.status, 200);
  assert.equal(decryptProviderKey(rows[0].encrypted_key, "owner"), "secret-key");
  assert.equal((await call("/" + saved.id, "PUT", { ...withoutKey, baseUrl: "https://different.provider.test/v1" })).status, 400);
  response = await call("/discover", "POST", { baseUrl: saved.baseUrl, providerId: saved.id });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).models, ["second-model", "shared/model"]);
  assert.equal(lastUpstream?.url, saved.baseUrl + "/models");
  assert.equal(lastUpstream?.key, "Bearer secret-key");
  const callsBeforePrivate = upstreamCalls;
  assert.equal((await call("/discover", "POST", { baseUrl: "https://private.provider.test/v1", apiKey: "test" })).status, 400);
  assert.equal(upstreamCalls, callsBeforePrivate);
  upstreamStatus = 401;
  assert.match((await (await call("/discover", "POST", { baseUrl: saved.baseUrl, providerId: saved.id })).json()).error.message, /HTTP 401/);
  upstreamStatus = 302;
  assert.match((await (await call("/discover", "POST", { baseUrl: saved.baseUrl, providerId: saved.id })).json()).error.message, /redirects/);
  upstreamStatus = 200;
  assert.equal((await call("/" + saved.id + "/chat", "POST", { modelId: "unknown", messages: [{ role: "user", content: "Hi" }] })).status, 400);
  response = await call("/" + saved.id + "/chat", "POST", { modelId: "shared/model", messages: [{ role: "user", content: "Hi" }], maxTokens: 100_000 });
  assert.equal(response.status, 200);
  const stream = await response.text();
  assert.match(stream, /Hello from custom/);
  assert.match(stream, /"done":true/);
  assert.match(stream, /"cost":0/);
  assert.equal(lastUpstream?.body.model, "shared/model");
  assert.equal(lastUpstream?.body.max_tokens, 8192);
  assert.equal(lastUpstream?.key, "Bearer secret-key");
  assert.equal(usage.at(-1)?.[7], 0);
  assert.equal(usage.at(-1)?.[10], true);
  upstreamStatus = 401;
  response = await call("/" + saved.id + "/chat", "POST", { modelId: "shared/model", messages: [{ role: "user", content: "Hi" }] });
  const failedStream = await response.text();
  assert.match(failedStream, /HTTP 401/);
  assert.equal(failedStream.includes("secret-key"), false);
  assert.equal(failedStream.includes('"done":true'), false);
  assert.equal((await call("/" + saved.id, "DELETE")).status, 204);
  assert.equal((await (await call("")).json()).data.length, 0);
  assert.equal((await call("/" + saved.id + "/chat", "POST", { modelId: "shared/model", messages: [{ role: "user", content: "Hi" }] })).status, 404);
  assert.equal(pinnedLookups, upstreamCalls);
  console.log("PASS: URL and IP restrictions, bounded model discovery, encryption, authenticated CRUD, tenant isolation, key preservation, DNS pinning, redirect blocking, model routing, streaming and provider errors.");
} finally {
  dns.promises.lookup = originalLookup;
  https.request = originalRequest;
  syncBuiltinESMExports();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await pool.end();
}
