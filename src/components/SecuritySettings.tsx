import { useCallback, useEffect, useState } from "react";
import { emailSecurity } from "../lib/emailSecurity";
import { Link } from "react-router-dom";
import { AlertTriangle, Loader2, LogOut, Monitor, Trash2 } from "lucide-react";
import { authClient, authFetch, useAuth } from "../lib/auth";

function messageFor(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  )
    return error.message;
  return "The request failed. Please try again.";
}

interface SessionInfo {
  id: string;
  current: boolean;
  device: string;
  browser: string | null;
  os: string | null;
  ip: string | null;
  lastSeenAt: string | null;
  createdAt: string | null;
  expiresAt: string;
}

function formatRelative(value: string | null): string {
  if (!value) return "—";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "—";
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 30) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(value).toLocaleDateString();
}

export function SecuritySettings() {
  const { user, refresh } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailNotice, setEmailNotice] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown === 0) return;
    const timer = window.setTimeout(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [revokeNotice, setRevokeNotice] = useState<string | null>(null);

  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const DELETE_PHRASE = "delete my account";

  async function deleteAccount() {
    if (deleteConfirmText.trim().toLowerCase() !== DELETE_PHRASE) return;
    if (
      !window.confirm(
        "This will permanently delete your account, API keys, usage history, " +
          "credits, and shared chats. There is no undo. Continue?",
      )
    ) {
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await authFetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ confirm: deleteConfirmText.trim() }),
      });
      if (!res.ok && res.status !== 204) {
        let msg = `HTTP ${res.status}`;
        try {
          const data = (await res.json()) as { error?: { message?: string } };
          if (data.error?.message) msg = data.error.message;
        } catch {
          /* response wasn't JSON — keep the status code */
        }
        throw new Error(msg);
      }
      await authClient.signOut().catch(() => undefined);
      window.location.href = "/";
    } catch (err) {
      console.error("Account deletion failed:", err);
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete account",
      );
      setDeleting(false);
    }
  }

  const refreshSessions = useCallback(async () => {
    setLoadingSessions(true);
    setSessionsError(null);
    try {
      const [response, current] = await Promise.all([
        authFetch("/api/auth/sessions"),
        authClient.getSession({
          fetchOptions: { headers: { "X-Force-Fetch": "true" } },
        }),
      ]);
      if (current.error) throw current.error;
      if (!current.data?.session?.id)
        throw new Error("Your session has expired. Please sign in again.");
      if (!response.ok)
        throw new Error("Could not load sessions. Please try again.");
      const body = (await response.json()) as { data: SessionInfo[] };
      setSessions(
        body.data.map((session) => ({
          ...session,
          current: session.id === current.data!.session.id,
        })),
      );
    } catch (error) {
      setSessions(null);
      setSessionsError(messageFor(error));
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  const handleRevokeOthers = async () => {
    if (
      !window.confirm(
        "Sign out of every other browser and device? You'll stay signed in here.",
      )
    )
      return;
    setRevoking(true);
    setRevokeNotice(null);
    try {
      const result = await authClient.revokeOtherSessions();
      if (result.error) throw result.error;
      setRevokeNotice(
        "Signed out of all other sessions. Existing API keys remain active.",
      );
      await refreshSessions();
    } catch (error) {
      setRevokeNotice(messageFor(error));
    } finally {
      setRevoking(false);
    }
  };

  async function revokeSession(id: string) {
    if (!window.confirm("Sign out this browser or device?")) return;
    setRevoking(true);
    setRevokeNotice(null);
    try {
      const [listed, current] = await Promise.all([
        authClient.listSessions(),
        authClient.getSession({
          fetchOptions: { headers: { "X-Force-Fetch": "true" } },
        }),
      ]);
      if (listed.error) throw listed.error;
      if (current.error) throw current.error;
      if (!current.data?.session) throw new Error("Please sign in again.");
      if (id === current.data.session.id)
        throw new Error("Use the account menu to sign out this device.");
      const target = listed.data?.find((session) => session.id === id);
      if (target) {
        const result = await authClient.revokeSession({ token: target.token });
        if (result.error) throw result.error;
      }
      setRevokeNotice("Session signed out.");
      await refreshSessions();
    } catch (error) {
      setRevokeNotice(messageFor(error));
    } finally {
      setRevoking(false);
    }
  }

  const otherSessionCount = (sessions ?? []).filter(
    (session) => !session.current,
  ).length;

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    setPasswordNotice(null);
    setPasswordError(null);
    if (newPassword !== confirmPassword) {
      setPasswordError("The new passwords do not match.");
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordError("Choose a different new password.");
      return;
    }
    setPasswordBusy(true);
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (result.error) throw result.error;
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordNotice(
        "Password changed. Your other sessions have been signed out.",
      );
      await refresh();
      await refreshSessions();
    } catch (error) {
      setPasswordError(messageFor(error));
    } finally {
      setPasswordBusy(false);
    }
  }

  async function sendCode() {
    if (!user?.email || cooldown > 0) return;
    setEmailBusy(true);
    setEmailNotice(null);
    setEmailError(null);
    try {
      const result = await emailSecurity.sendVerificationCode(user.email);
      if (result.error) throw result.error;
      setCodeSent(true);
      setCooldown(60);
      setEmailNotice(
        "Verification code sent. Check your inbox and spam folder. Wait one minute before resending.",
      );
    } catch (error) {
      setEmailError(messageFor(error));
    } finally {
      setEmailBusy(false);
    }
  }

  async function verifyEmail(event: React.FormEvent) {
    event.preventDefault();
    if (!user?.email) return;
    setEmailBusy(true);
    setEmailNotice(null);
    setEmailError(null);
    try {
      const result = await emailSecurity.verifyEmail(user.email, otp.trim());
      if (result.error) throw result.error;
      await authClient.getSession({
        fetchOptions: { headers: { "X-Force-Fetch": "true" } },
      });
      await refresh();
      setOtp("");
      setCodeSent(false);
      setEmailNotice("Email address verified.");
    } catch (error) {
      setEmailError(messageFor(error));
    } finally {
      setEmailBusy(false);
    }
  }

  const inputClass =
    "w-full min-w-0 bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50";
  const buttonClass =
    "inline-flex items-center justify-center gap-2 px-4 py-2 border border-border rounded-md text-sm font-medium hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="space-y-6">
      <section className="border border-border rounded-lg p-4 sm:p-5 bg-card">
        <h2 className="text-lg font-bold">Password</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Changing your password also signs out your other browsers and devices.
        </p>
        <form onSubmit={changePassword} className="mt-4 space-y-4 max-w-md">
          <div>
            <label htmlFor="current-password" className="block text-sm mb-1.5">
              Current password
            </label>
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={passwordBusy}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="new-password" className="block text-sm mb-1.5">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={passwordBusy}
              className={inputClass}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Use 8–128 characters.
            </p>
          </div>
          <div>
            <label htmlFor="confirm-password" className="block text-sm mb-1.5">
              Confirm new password
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={passwordBusy}
              className={inputClass}
            />
          </div>
          {passwordError && (
            <p role="alert" className="text-sm text-destructive">
              {passwordError}
            </p>
          )}
          {passwordNotice && (
            <p role="status" className="text-sm text-muted-foreground">
              {passwordNotice}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4">
            <button disabled={passwordBusy} className={buttonClass}>
              {passwordBusy ? "Changing…" : "Change password"}
            </button>
            <Link
              to="/reset-password"
              className="text-sm underline underline-offset-4"
            >
              Forgot your password?
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            If you signed up with a social account, use password reset to set a
            password for your email.
          </p>
        </form>
      </section>
      <section className="border border-border rounded-lg p-4 sm:p-5 bg-card">
        <h2 className="text-lg font-bold">Email verification</h2>
        <p className="text-sm break-words mt-2">
          {user?.email ?? "No email address on this account"}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {user?.emailVerified ? "Verified" : "Not verified"}
        </p>
        {!user?.emailVerified && user?.email && (
          <div className="mt-4 space-y-3">
            <button
              type="button"
              onClick={() => void sendCode()}
              disabled={emailBusy || cooldown > 0}
              className={buttonClass}
            >
              {emailBusy
                ? "Please wait…"
                : cooldown > 0
                  ? `Resend in ${cooldown}s`
                  : codeSent
                    ? "Resend verification code"
                    : "Send verification code"}
            </button>
            {codeSent && (
              <form onSubmit={verifyEmail} className="space-y-3 max-w-sm">
                <div>
                  <label
                    htmlFor="verification-code"
                    className="block text-sm mb-1.5"
                  >
                    Verification code
                  </label>
                  <input
                    id="verification-code"
                    required
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    maxLength={12}
                    className={inputClass}
                    disabled={emailBusy}
                  />
                </div>
                <button disabled={emailBusy} className={buttonClass}>
                  Verify email
                </button>
              </form>
            )}
          </div>
        )}
        {emailError && (
          <p role="alert" className="text-sm text-destructive mt-3">
            {emailError}
          </p>
        )}
        {emailNotice && (
          <p role="status" className="text-sm text-muted-foreground mt-3">
            {emailNotice}
          </p>
        )}
      </section>
      {/* Active sessions */}
      <div className="pt-8 mt-8 border-t border-border">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-bold">Active sessions</h3>
            <p className="text-xs sm:text-sm text-muted-foreground font-mono mt-1">
              Manage browsers and devices signed into your account. API keys are
              managed in Keys. A signed-out device may keep access briefly until
              its current sign-in token expires.
            </p>
          </div>
          <button
            onClick={handleRevokeOthers}
            disabled={
              revoking ||
              loadingSessions ||
              !!sessionsError ||
              otherSessionCount === 0
            }
            className="shrink-0 inline-flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-md text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={
              otherSessionCount === 0
                ? "No other active sessions"
                : "Sign out of every other session"
            }
          >
            <LogOut className="w-3.5 h-3.5" />
            {revoking ? "Signing out…" : "Sign out everywhere else"}
          </button>
        </div>

        {revokeNotice && (
          <div
            role="status"
            className="mb-4 text-xs font-mono text-muted-foreground border border-border rounded-md bg-muted/20 px-3 py-2"
          >
            {revokeNotice}
          </div>
        )}

        {sessionsError ? (
          <div className="border border-yellow-500/40 bg-yellow-500/10 text-yellow-200 rounded-md px-4 py-3 text-sm font-mono flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{sessionsError}</span>
            <button
              onClick={() => void refreshSessions()}
              className="underline shrink-0"
            >
              Retry
            </button>
          </div>
        ) : sessions === null ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground text-sm font-mono">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
          </div>
        ) : sessions.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground font-mono">
            No active sessions found.
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden bg-card divide-y divide-border">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4"
              >
                <div className="flex items-start gap-2 sm:gap-3 min-w-0">
                  <Monitor className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                      {s.device}
                      {s.current && (
                        <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 text-[10px] font-mono uppercase">
                          this device
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>{s.ip ?? "ip unknown"}</span>
                      <span className="hidden sm:inline">
                        id {s.id.slice(0, 8)}…
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground font-mono sm:text-right pl-7 sm:pl-0">
                  <div>Active {formatRelative(s.lastSeenAt)}</div>
                  <div className="text-[11px] mt-0.5">
                    Expires {new Date(s.expiresAt).toLocaleString()}
                  </div>
                </div>
                {!s.current && (
                  <button
                    onClick={() => void revokeSession(s.id)}
                    disabled={revoking || loadingSessions}
                    className="self-start sm:self-center shrink-0 px-3 py-2 border border-border rounded-md text-xs hover:bg-muted disabled:opacity-50"
                    aria-label={`Sign out ${s.device}`}
                  >
                    {revoking ? "Please wait…" : "Sign out"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Danger zone — permanent account deletion */}
      <div className="border border-destructive/40 rounded-lg p-4 sm:p-5 bg-destructive/5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm">Delete account</h3>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              Permanently removes your profile, API keys, usage history, credit
              balance, and shared chat links. This cannot be undone.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label
                  htmlFor="delete-confirm"
                  className="text-xs font-mono text-muted-foreground"
                >
                  Type{" "}
                  <span className="font-bold text-foreground">
                    {DELETE_PHRASE}
                  </span>{" "}
                  to confirm
                </label>
                <input
                  id="delete-confirm"
                  type="text"
                  autoComplete="off"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  disabled={deleting}
                  className="mt-1 w-full sm:w-80 bg-background border border-border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-destructive"
                  placeholder={DELETE_PHRASE}
                />
              </div>
              {deleteError && (
                <div
                  role="alert"
                  className="text-xs font-mono text-destructive"
                >
                  {deleteError}
                </div>
              )}
              <button
                onClick={() => void deleteAccount()}
                disabled={
                  deleting ||
                  deleteConfirmText.trim().toLowerCase() !== DELETE_PHRASE
                }
                className="inline-flex items-center justify-center gap-2 bg-destructive text-destructive-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-destructive/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed w-full sm:w-auto"
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                {deleting ? "Deleting…" : "Delete my account"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
