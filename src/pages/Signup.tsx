import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, authClient } from "../lib/auth";

/**
 * Email + password sign-up backed by Neon Auth (Managed Better Auth).
 * New users get the $5 welcome credit via the server's upsert-on-first-login.
 */
export default function Signup() {
  const navigate = useNavigate();
  const { user, loading: authLoading, refresh } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in → straight to the dashboard.
  if (!authLoading && user) {
    navigate("/chat", { replace: true });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await authClient.signUp.email({
        name: name.trim() || email.split("@")[0] || "User",
        email,
        password,
      });
      if (result.error) {
        setError(result.error.message || "Sign-up failed. Try again.");
        return;
      }
      await refresh();
      navigate("/chat");
    } catch {
      setError("Could not reach the auth service. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background p-4 py-10 animate-fade-in">
      <div className="w-full max-w-sm">
        <Link to="/" className="inline-flex justify-center mb-8 w-full">
          <div className="w-8 h-8 bg-foreground rounded-sm grid place-items-center">
            <div className="w-3 h-3 bg-background rounded-sm" />
          </div>
        </Link>

        <h1 className="text-2xl font-bold tracking-tight mb-2 text-center">Create your account</h1>
        <p className="text-muted-foreground text-sm mb-8 font-mono text-center">
          Starts with a $5 welcome credit.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1.5">
              Name
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ada Lovelace"
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full h-11 inline-flex items-center justify-center bg-foreground text-background rounded-md text-sm font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50"
          >
            {busy ? "Creating account…" : "Sign up"}
          </button>
        </form>

        <p className="text-sm text-muted-foreground text-center mt-6">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-foreground hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
