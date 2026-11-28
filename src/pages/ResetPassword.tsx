import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { emailSecurity } from "../lib/emailSecurity";
import { useAuth } from "../lib/auth";

export default function ResetPassword() {
  const { logout } = useAuth();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [step, setStep] = useState<"email" | "reset" | "done">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown === 0) return;
    const timer = window.setTimeout(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function sendCode(event?: React.FormEvent) {
    event?.preventDefault();
    if (cooldown > 0) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await emailSecurity.sendResetCode(email.trim());
      if (result.error) throw result.error;
      setStep("reset");
      setCooldown(60);
      setNotice(
        "If this email has an account, a reset code has been sent. Check your inbox and spam folder. Wait one minute before resending.",
      );
    } catch (error) {
      setError(
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "Could not send a reset code. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (password !== confirmation) {
      setError("The new passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const result = await emailSecurity.resetPassword(
        email.trim(),
        otp.trim(),
        password,
      );
      if (result.error) throw result.error;
      setPassword("");
      setConfirmation("");
      setOtp("");
      setStep("done");
      await logout();
    } catch (error) {
      setError(
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "Could not reset your password. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "w-full min-w-0 h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50";
  const buttonClass =
    "w-full min-h-11 inline-flex items-center justify-center bg-foreground text-background rounded-md text-sm font-medium hover:bg-foreground/90 disabled:opacity-50";

  return (
    <main className="min-h-dvh flex items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold">Reset password</h1>
        {step === "done" ? (
          <p role="status" className="text-sm text-muted-foreground">
            Your password has been reset. Sign in with your new password.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {step === "email"
                ? "We'll send a reset code to your account email."
                : `Enter the code sent to ${email} and choose a new password.`}
            </p>
            {step === "email" ? (
              <form onSubmit={sendCode} className="space-y-4">
                <div>
                  <label htmlFor="reset-email" className="block text-sm mb-1.5">
                    Email
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={busy}
                    className={inputClass}
                  />
                </div>
                <button disabled={busy || cooldown > 0} className={buttonClass}>
                  {busy
                    ? "Sending…"
                    : cooldown > 0
                      ? `Send code in ${cooldown}s`
                      : "Send reset code"}
                </button>
              </form>
            ) : (
              <form onSubmit={resetPassword} className="space-y-4">
                <div>
                  <label htmlFor="reset-code" className="block text-sm mb-1.5">
                    Reset code
                  </label>
                  <input
                    id="reset-code"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    required
                    maxLength={12}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    disabled={busy}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label
                    htmlFor="reset-password"
                    className="block text-sm mb-1.5"
                  >
                    New password
                  </label>
                  <input
                    id="reset-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={128}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={busy}
                    className={inputClass}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Use 8–128 characters.
                  </p>
                </div>
                <div>
                  <label
                    htmlFor="reset-confirmation"
                    className="block text-sm mb-1.5"
                  >
                    Confirm new password
                  </label>
                  <input
                    id="reset-confirmation"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={128}
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    disabled={busy}
                    className={inputClass}
                  />
                </div>
                <button disabled={busy} className={buttonClass}>
                  {busy ? "Resetting…" : "Reset password"}
                </button>
                <div className="flex flex-wrap justify-between gap-3 text-sm">
                  <button
                    type="button"
                    disabled={busy || cooldown > 0}
                    onClick={() => void sendCode()}
                    className="underline disabled:opacity-50"
                  >
                    {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setStep("email");
                      setOtp("");
                      setError(null);
                      setNotice(null);
                    }}
                    className="underline"
                  >
                    Change email
                  </button>
                </div>
              </form>
            )}
            {notice && (
              <p role="status" className="text-sm text-muted-foreground">
                {notice}
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </>
        )}
        <Link
          to="/login"
          className="inline-block text-sm underline underline-offset-4"
        >
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
