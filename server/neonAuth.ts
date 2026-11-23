import type { Request } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Neon Auth (Managed Better Auth) verification.
 *
 * The browser SDK (@neon/neon-js) signs the user in against Neon's managed
 * Better Auth service, which keeps the session cookie on the Neon auth domain.
 * Our Express API never sees that cookie — instead the SPA forwards the JWT
 * from `session.access_token` as `Authorization: Bearer <token>`. We verify
 * the JWT's signature against the service's published JWKS.
 *
 * Required env vars:
 *   NEON_AUTH_JWKS_URL  — e.g. https://ep-xxx.neonauth.../neondb/auth/.well-known/jwks.json
 */

interface NeonClaims {
  sub: string;
  email: string | null;
  name: string | null;
  picture: string | null;
}

const JWKS_URL = process.env.NEON_AUTH_JWKS_URL;

let remoteJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!JWKS_URL) {
    throw new Error(
      "NEON_AUTH_JWKS_URL is not set. Enable Neon Auth on the database branch and copy the JWKS URL from the Neon console (or the enable-auth API response).",
    );
  }
  if (!remoteJwks) {
    remoteJwks = createRemoteJWKSet(new URL(JWKS_URL));
  }
  return remoteJwks;
}

/** Extract the Bearer token from the request, if present. */
export function tokenFromRequest(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/**
 * Verify a Neon Auth JWT. Returns the claims we care about, or null when the
 * token is missing/invalid/expired. Signature verification hits the remote
 * JWKS (cached + auto-rotated by jose).
 */
export async function verifyNeonToken(token: string): Promise<NeonClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      algorithms: ["RS256", "ES256", "EdDSA", "PS256"],
    });
    if (typeof payload.sub !== "string" || !payload.sub) return null;
    return {
      sub: payload.sub,
      email: typeof payload.email === "string" ? payload.email : null,
      name: typeof payload.name === "string" ? payload.name : null,
      picture: typeof payload.picture === "string" ? payload.picture : null,
    };
  } catch (err) {
    console.error("Neon Auth token verification failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
