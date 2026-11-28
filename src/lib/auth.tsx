import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createAuthClient } from "@neon/neon-js/auth";

/**
 * Neon Auth (Managed Better Auth) client.
 *
 * The session cookie lives on Neon's managed auth domain, so our own API
 * never sees it. The SPA talks to Neon directly for sign-in / sign-out /
 * session state, and forwards the JWT from `session.access_token` to our
 * Express API as `Authorization: Bearer <token>`.
 */

const NEON_AUTH_URL = (import.meta.env.VITE_NEON_AUTH_URL ?? "") as string;

export const authClient = createAuthClient(NEON_AUTH_URL);

export interface AuthUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  emailVerified?: boolean;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  /** Navigate to the sign-in page. */
  login(): void;
  /** Sign out via Neon Auth and clear local state. */
  logout(): void | Promise<void>;
  refresh(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

interface NeonSessionUser {
  id?: string;
  email?: string;
  name?: string;
  image?: string | null;
  emailVerified?: boolean;
}

function mapNeonUser(u: NeonSessionUser | undefined | null): AuthUser | null {
  if (!u?.id) return null;
  const nameParts = u.name ? u.name.split(/\s+/) : [];
  return {
    id: u.id,
    email: u.email ?? null,
    firstName: nameParts[0] ?? null,
    lastName: nameParts.length > 1 ? nameParts.slice(1).join(" ") : null,
    profileImageUrl: u.image ?? null,
    emailVerified: u.emailVerified === true,
  };
}

async function fetchSession(): Promise<{
  user: AuthUser | null;
  accessToken: string | null;
}> {
  try {
    const result = await authClient.getSession();
    const data = (result as { data?: { session?: { access_token?: string; token?: string } | null; user?: NeonSessionUser | null } }).data;
    if (data?.session && data?.user) {
      return {
        user: mapNeonUser(data.user),
        // @neon/neon-js exposes the session JWT as `token` (older docs call it
        // `access_token`) — accept either spelling.
        accessToken: data.session.access_token ?? data.session.token ?? null,
      };
    }
  } catch {
    // Network / service errors → treat as signed out.
  }
  return { user: null, accessToken: null };
}

/** Get the current Neon Auth JWT, refreshing the session if needed. */
export async function getAccessToken(): Promise<string | null> {
  return (await fetchSession()).accessToken;
}

/**
 * Drop-in replacement for `fetch` that attaches the Neon Auth JWT as a
 * Bearer token. Use for any call to our own API that requires a signed-in
 * session (the chat/image endpoints instead take an Orbitron API key).
 */
export async function authFetch(
  input: string | URL | globalThis.Request,
  init?: RequestInit,
): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(init?.headers);
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers, credentials: "include" });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { user: next } = await fetchSession();
    setUser(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(() => {
    window.location.href = "/login";
  }, []);

  const logout = useCallback(async () => {
    try {
      await authClient.signOut();
    } catch {
      // Best-effort — clear local state regardless.
    }
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      login,
      logout,
      refresh,
    }),
    [user, loading, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Convenience helper: a friendly display name for the user. */
export function displayNameFor(user: AuthUser): string {
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  if (full) return full;
  if (user.email) return user.email.split("@")[0];
  return "Account";
}

export function initialsFor(user: AuthUser): string {
  const f = (user.firstName?.[0] || "").toUpperCase();
  const l = (user.lastName?.[0] || "").toUpperCase();
  if (f || l) return `${f}${l}` || f || l || "U";
  if (user.email) {
    return user.email.slice(0, 2).toUpperCase();
  }
  return "U";
}
