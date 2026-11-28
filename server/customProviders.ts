import type { Express, Request, Response } from "express";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import OpenAI from "openai";
import { query } from "./db";
import { requireAuth, requireApiKey } from "./auth";
import { normalizeProviderUrl, providerFetch, readModelIds } from "./providerNetwork";
import { recordUsage } from "./usage";

interface ProviderRow {
  id: string;
  user_id: string;
  name: string;
  base_url: string;
  encrypted_key: string;
  models: string[];
}

export function encryptProviderKey(secret: string, userId: string): string {
  const key = createHash("sha256").update(process.env.BYOK_ENCRYPTION_KEY || process.env.DATABASE_URL || "").digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(userId));
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString("base64url")).join(".");
}

export function decryptProviderKey(value: string, userId: string): string {
  const key = createHash("sha256").update(process.env.BYOK_ENCRYPTION_KEY || process.env.DATABASE_URL || "").digest();
  const [iv, tag, ciphertext] = value.split(".").map((part) => Buffer.from(part, "base64url"));
  const cipher = createDecipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(userId));
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(ciphertext), cipher.final()]).toString("utf8");
}

function publicProvider(row: ProviderRow) {
  return { id: row.id, name: row.name, baseUrl: row.base_url, models: row.models };
}

function validId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
}

async function ownedProvider(id: unknown, userId: string): Promise<ProviderRow | undefined> {
  if (!validId(id)) return undefined;
  const result = await query<ProviderRow>(
    "SELECT * FROM custom_providers WHERE id = $1 AND user_id = $2", [id, userId],
  );
  return result.rows[0];
}

function readKey(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 8192 || /[\r\n]/.test(value)) {
    throw new Error("Enter a valid provider API key.");
  }
  return value.trim();
}

function readModels(value: unknown): string[] {
  if (!Array.isArray(value) || !value.length || value.length > 1000
    || value.some((m) => typeof m !== "string" || !m.trim() || m.length > 200)) {
    throw new Error("Enter a model name or fetch the provider's models (up to 1,000).");
  }
  return [...new Set(value.map((m: string) => m.trim()))];
}

function fail(res: Response, message: string, status = 400) {
  return res.status(status).json({ error: { message } });
}

export function registerCustomProviderRoutes(app: Express) {
  app.get("/api/custom-providers", requireAuth, async (req, res) => {
    const result = await query<ProviderRow>(
      "SELECT id, name, base_url, models FROM custom_providers WHERE user_id = $1 ORDER BY created_at", [req.auth!.user.id],
    );
    res.json({ data: result.rows.map(publicProvider) });
  });

  app.post("/api/custom-providers/discover", requireAuth, async (req, res) => {
    try {
      const userId = req.auth!.user.id;
      const body = req.body || {};
      const existing = body.providerId ? await ownedProvider(body.providerId, userId) : undefined;
      if (body.providerId && !existing) return fail(res, "Provider not found.", 404);
      const baseUrl = normalizeProviderUrl(body.baseUrl);
      if (!body.apiKey && existing && baseUrl !== existing.base_url) {
        return fail(res, "Re-enter the API key when changing the base URL.");
      }
      const apiKey = body.apiKey ? readKey(body.apiKey) : existing ? decryptProviderKey(existing.encrypted_key, userId) : readKey(undefined);
      const response = await providerFetch(baseUrl + "/models", {
        headers: { Authorization: "Bearer " + apiKey, Accept: "application/json" },
        signal: AbortSignal.timeout(20_000),
      });
      res.json({ models: await readModelIds(response) });
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : "Could not fetch models.");
    }
  });

  const save = async (req: Request, res: Response) => {
    const userId = req.auth!.user.id;
    const body = req.body || {};
    const existing = req.params.id ? await ownedProvider(req.params.id, userId) : undefined;
    if (req.params.id && !existing) return fail(res, "Provider not found.", 404);
    let name: string, baseUrl: string, models: string[], encryptedKey: string;
    try {
      if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 100) {
        throw new Error("Enter a provider name (up to 100 characters).");
      }
      name = body.name.trim();
      baseUrl = normalizeProviderUrl(body.baseUrl);
      models = readModels(body.models);
      if (!body.apiKey && existing && baseUrl !== existing.base_url) {
        throw new Error("Re-enter the API key when changing the base URL.");
      }
      encryptedKey = body.apiKey
        ? encryptProviderKey(readKey(body.apiKey), userId)
        : existing?.encrypted_key ?? encryptProviderKey(readKey(undefined), userId);
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : "Invalid provider details.");
    }
    if (!existing) {
      const count = await query<{ count: string }>("SELECT count(*) FROM custom_providers WHERE user_id = $1", [userId]);
      if (Number(count.rows[0].count) >= 20) return fail(res, "You can save up to 20 custom providers.");
    }
    const result = existing
      ? await query<ProviderRow>(
          "UPDATE custom_providers SET name = $1, base_url = $2, encrypted_key = $3, models = $4::jsonb WHERE id = $5 AND user_id = $6 RETURNING *",
          [name, baseUrl, encryptedKey, JSON.stringify(models), existing.id, userId],
        )
      : await query<ProviderRow>(
          "INSERT INTO custom_providers (user_id, name, base_url, encrypted_key, models) VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING *",
          [userId, name, baseUrl, encryptedKey, JSON.stringify(models)],
        );
    res.status(existing ? 200 : 201).json({ data: publicProvider(result.rows[0]) });
  };
  app.post("/api/custom-providers", requireAuth, save);
  app.put("/api/custom-providers/:id", requireAuth, save);
  app.delete("/api/custom-providers/:id", requireAuth, async (req, res) => {
    const existing = await ownedProvider(req.params.id, req.auth!.user.id);
    if (!existing) return fail(res, "Provider not found.", 404);
    await query("DELETE FROM custom_providers WHERE id = $1 AND user_id = $2", [existing.id, req.auth!.user.id]);
    res.status(204).end();
  });

  app.post("/api/custom-providers/:id/chat", requireApiKey, async (req, res) => {
    const userId = req.auth!.user.id;
    const provider = await ownedProvider(req.params.id, userId);
    if (!provider) return fail(res, "Provider not found. Add it in Settings.", 404);
    const { modelId, messages, temperature, maxTokens } = req.body || {};
    if (typeof modelId !== "string" || !provider.models.includes(modelId)) {
      return fail(res, "This model is not saved for the selected provider.");
    }
    if (!Array.isArray(messages) || !messages.length || messages.length > 200
      || messages.some((m: any) => !["user", "assistant", "system"].includes(m?.role) || typeof m.content !== "string")) {
      return fail(res, "Provide between 1 and 200 text messages.");
    }
    const controller = new AbortController();
    res.on("close", () => controller.abort());
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();
    const send = (body: unknown) => { if (!res.destroyed) res.write("data: " + JSON.stringify(body) + "\n\n"); };
    const started = Date.now();
    let firstToken = 0, inputTokens = 0, outputTokens = 0, text = "", success = false;
    try {
      const client = new OpenAI({
        apiKey: decryptProviderKey(provider.encrypted_key, userId),
        baseURL: provider.base_url,
        fetch: providerFetch,
        maxRetries: 0,
        timeout: 60_000,
      });
      const stream = await client.chat.completions.create({
        model: modelId,
        messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
        stream: true,
        max_tokens: Math.max(1, Math.min(8192, Number.isFinite(maxTokens) ? Math.floor(maxTokens) : 4096)),
        ...(typeof temperature === "number" && Number.isFinite(temperature)
          ? { temperature: Math.max(0, Math.min(2, temperature)) } : {}),
      }, { signal: controller.signal });
      for await (const chunk of stream) {
        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens;
          outputTokens = chunk.usage.completion_tokens;
        }
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          if (!firstToken) firstToken = Date.now() - started;
          text += delta;
          send({ delta });
        }
      }
      success = true;
      inputTokens ||= Math.ceil(messages.reduce((sum: number, m: any) => sum + m.content.length, 0) / 4);
      outputTokens ||= Math.ceil(text.length / 4);
      send({ done: true, cost: 0, inputTokens, outputTokens, latencyMs: firstToken, totalMs: Date.now() - started });
    } catch (error) {
      if (!controller.signal.aborted) {
        const status = error instanceof OpenAI.APIError ? error.status : undefined;
        send({ error: status
          ? `Provider request failed (HTTP ${status}). Check the API key, model and base URL in Settings.`
          : "Could not reach the custom provider. Check its base URL and try again." });
      }
    } finally {
      res.end();
      void recordUsage({
        userId, apiKeyId: req.auth!.apiKeyId ?? null, kind: "chat",
        modelId: "custom/" + provider.id + "/" + encodeURIComponent(modelId),
        provider: provider.name, inputTokens, outputTokens, costUsd: 0,
        latencyMs: firstToken || null, totalMs: Date.now() - started, success,
      });
    }
  });
}
