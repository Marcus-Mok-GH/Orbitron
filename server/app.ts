import express from "express";
import { registerChatRoutes } from "./chat";
import { registerApiRoutes } from "./api";
import { registerKeyRoutes } from "./auth";
import { registerAnthropicCompatRoutes } from "./anthropicCompat";
import { registerOpenAICompatRoutes } from "./openaiCompat";
import { registerAuthRoutes } from "./authRoutes";
import { ensureSchema } from "./db";

export interface AppOptions {
  serveStatic?: boolean;
}

/**
 * Build the Orbitron Express app (routes + optional static SPA serving).
 * Shared by the node server entry (server/index.ts) and the Vercel
 * serverless entry (api/index.ts). Schema bootstrap is idempotent.
 */
export async function createOrbitronApp(options: AppOptions = {}) {
  await ensureSchema();

  const app = express();
  app.use(express.json({ limit: "10mb" }));

  // Neon Auth (Managed Better Auth). The browser session lives on Neon's
  // managed auth service; this API authenticates requests via the JWT the SPA
  // forwards in `Authorization: Bearer <token>` (see server/neonAuth.ts).
  registerAuthRoutes(app);

  registerKeyRoutes(app);
  registerChatRoutes(app);
  registerAnthropicCompatRoutes(app);
  registerOpenAICompatRoutes(app);
  registerApiRoutes(app);

  if (options.serveStatic) {
    const path = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const distRoot = path.resolve(__dirname, "../dist");
    app.use(express.static(distRoot));
    // SPA fallback — Express 5 / path-to-regexp v8 no longer accepts bare "*",
    // so use a catch-all middleware after the static handler instead.
    app.use((_req, res) => {
      res.sendFile(path.join(distRoot, "index.html"));
    });
  }

  return app;
}
