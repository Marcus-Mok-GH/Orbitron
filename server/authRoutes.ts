import type { Express, Request, Response } from "express";
import { UAParser } from "ua-parser-js";
import { requireAuth } from "./auth";
import { authStorage } from "./storage";
import { query } from "./db";

/**
 * Auth-related routes backed by Neon Auth.
 *
 * The browser session lives on Neon's managed auth service (cookie on their
 * domain); our API sees the user via the verified JWT in
 * `Authorization: Bearer <token>`, resolved by requireAuth into req.auth.
 */

export function registerAuthRoutes(app: Express): void {
  // Get current authenticated user
  app.get("/api/auth/user", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await authStorage.getUser(req.auth!.user.id);
      res.json(user ?? req.auth!.user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Get user preferences
  app.get("/api/auth/preferences", requireAuth, async (req: Request, res: Response) => {
    try {
      const preferences = await authStorage.getPreferences(req.auth!.user.id);
      res.json(preferences);
    } catch (error) {
      console.error("Error fetching preferences:", error);
      res.status(500).json({ message: "Failed to fetch preferences" });
    }
  });

  // Update user preferences
  app.put("/api/auth/preferences", requireAuth, async (req: Request, res: Response) => {
    try {
      const updates = req.body as Record<string, unknown>;

      // Validate theme if provided
      if (
        updates.theme !== undefined &&
        !["light", "dark", "system"].includes(updates.theme as string)
      ) {
        return res.status(400).json({ message: "Invalid theme value" });
      }

      // Validate usage alert threshold if provided
      if (
        updates.usageAlertThresholdCents !== undefined &&
        (typeof updates.usageAlertThresholdCents !== "number" ||
          updates.usageAlertThresholdCents < 0)
      ) {
        return res.status(400).json({ message: "Invalid usage alert threshold" });
      }

      const preferences = await authStorage.updatePreferences(
        req.auth!.user.id,
        updates as never,
      );
      res.json(preferences);
    } catch (error) {
      console.error("Error updating preferences:", error);
      res.status(500).json({ message: "Failed to update preferences" });
    }
  });

  // GET /api/auth/sessions — active sessions for the current user, read from
  // the neon_auth.session table that Neon Auth maintains in our database.
  app.get("/api/auth/sessions", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.auth!.user.id;
      const result = await query<{
        id: string;
        "expiresAt": Date;
        "createdAt": Date;
        "updatedAt": Date;
        "ipAddress": string | null;
        "userAgent": string | null;
      }>(
        `SELECT id, "expiresAt", "createdAt", "updatedAt", "ipAddress", "userAgent"
           FROM neon_auth.session
          WHERE "userId" = $1::uuid
            AND "expiresAt" > NOW()
          ORDER BY "updatedAt" DESC`,
        [userId],
      );

      const data = result.rows.map((r) => ({
        id: r.id,
        device: r.userAgent ? describeUA(r.userAgent).device : "Unknown device",
        browser: r.userAgent ? describeUA(r.userAgent).browser : null,
        os: r.userAgent ? describeUA(r.userAgent).os : null,
        ip: r.ipAddress,
        lastSeenAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : null,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
        expiresAt: new Date(r.expiresAt).toISOString(),
      }));

      res.set("Cache-Control", "no-store").json({ data });
    } catch (err) {
      console.error("list sessions failed:", err);
      res.status(500).json({ message: "Failed to load sessions" });
    }
  });
}

function describeUA(ua: string): {
  device: string;
  browser: string | null;
  os: string | null;
} {
  const parsed = new UAParser(ua).getResult();
  const browser = parsed.browser.name || null;
  const os = parsed.os.name
    ? `${parsed.os.name}${parsed.os.version ? ` ${parsed.os.version}` : ""}`
    : null;
  if (browser && os) return { device: `${browser} on ${os}`, browser, os };
  if (browser) return { device: browser, browser, os: null };
  if (os) return { device: os, browser: null, os };
  return { device: "Unknown device", browser: null, os: null };
}
