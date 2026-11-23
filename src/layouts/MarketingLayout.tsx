import { useEffect, useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useAuth } from "../lib/auth";

type AggregateStatus = "operational" | "degraded" | "down" | "loading";

const PILL_META: Record<AggregateStatus, { dot: string; label: string }> = {
  operational: { dot: "bg-green-500", label: "All systems operational" },
  degraded: { dot: "bg-yellow-500", label: "Degraded performance" },
  down: { dot: "bg-red-500", label: "Major outage" },
  loading: { dot: "bg-muted-foreground/40 animate-pulse", label: "Checking status…" },
};

export function MarketingLayout() {
  const location = useLocation();
  const { user, loading: authLoading, login } = useAuth();
  const [systemStatus, setSystemStatus] = useState<AggregateStatus>("loading");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { status: AggregateStatus };
        if (!cancelled) setSystemStatus(data.status);
      } catch {
        if (!cancelled) setSystemStatus("down");
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const pill = PILL_META[systemStatus];

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-top">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 sm:gap-6">
            <Link to="/" className="flex items-center gap-2 font-mono font-bold tracking-tighter text-sm sm:text-base">
              <div className="w-5 h-5 bg-foreground rounded-sm grid place-items-center">
                <div className="w-2 h-2 bg-background rounded-sm" />
              </div>
              SWITCHBOARD
            </Link>
            <nav className="hidden md:flex items-center gap-4 sm:gap-6 text-sm font-medium">
              <Link to="/explore" className="text-muted-foreground hover:text-foreground transition-colors">Explore</Link>
              <Link to="/models" className="text-muted-foreground hover:text-foreground transition-colors">Models</Link>
              <Link to="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
              <Link to="/docs" className="text-muted-foreground hover:text-foreground transition-colors">Docs</Link>
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              to="/status"
              className="hidden lg:flex items-center gap-2 text-xs font-mono text-muted-foreground border border-border rounded-full px-3 py-1 hover:text-foreground hover:border-foreground/30 transition-colors"
              title="View detailed status"
            >
              <div className={`w-1.5 h-1.5 rounded-full ${pill.dot}`} />
              {pill.label}
            </Link>
            {authLoading ? null : user ? (
              <Link
                to="/chat"
                className="text-xs sm:text-sm font-medium bg-foreground text-background px-3 sm:px-4 py-1.5 rounded-md hover:bg-foreground/90 transition-colors whitespace-nowrap"
              >
                <span className="sm:hidden">Dashboard</span>
                <span className="hidden sm:inline">Open Dashboard</span>
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  onClick={login}
                  className="text-sm font-medium hover:text-primary transition-colors hidden xs:block"
                >
                  Log in
                </button>
                <button
                  type="button"
                  onClick={login}
                  className="text-xs sm:text-sm font-medium bg-foreground text-background px-3 sm:px-4 py-1.5 rounded-md hover:bg-foreground/90 transition-colors whitespace-nowrap"
                >
                  <span className="xs:hidden">Start</span>
                  <span className="hidden xs:inline">Get Started</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setMobileNavOpen((open) => !open)}
              className="md:hidden p-2 -mr-1 rounded-md hover:bg-muted touch-target"
              aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileNavOpen}
            >
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileNavOpen && (
          <div className="md:hidden border-t border-border/60 bg-background px-4 pb-4 pt-1 animate-fade-in">
            <nav className="flex flex-col text-sm font-medium">
              {[
                { to: "/explore", label: "Explore" },
                { to: "/models", label: "Models" },
                { to: "/pricing", label: "Pricing" },
                { to: "/docs", label: "Docs" },
              ].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`py-3 border-b border-border/50 transition-colors ${
                    location.pathname.startsWith(item.to)
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <Link
                to="/status"
                className="mt-3 flex items-center gap-2 text-xs font-mono text-muted-foreground border border-border rounded-full px-3 py-2 w-fit"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${pill.dot}`} />
                {pill.label}
              </Link>
              {!authLoading && !user && (
                <button
                  type="button"
                  onClick={login}
                  className="mt-3 py-3 text-left text-sm font-medium text-muted-foreground"
                >
                  Log in
                </button>
              )}
            </nav>
          </div>
        )}
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-border py-8 sm:py-12 bg-muted/20">
        <div className="container mx-auto px-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
          <div>
            <div className="flex items-center gap-2 font-mono font-bold tracking-tighter mb-4">
              SWITCHBOARD
            </div>
            <p className="text-sm text-muted-foreground">The neutral gateway to every frontier model.</p>
          </div>
          <div>
            <h4 className="font-mono text-sm font-bold mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/explore" className="hover:text-foreground">Model Index</Link></li>
              <li><Link to="/explore/compare" className="hover:text-foreground">Compare</Link></li>
              <li><Link to="/explore/calculator" className="hover:text-foreground">Cost Calculator</Link></li>
              <li><Link to="/models" className="hover:text-foreground">Gateway Models</Link></li>
              <li><Link to="/pricing" className="hover:text-foreground">Pricing</Link></li>
              <li><Link to="/docs" className="hover:text-foreground">Documentation</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-mono text-sm font-bold mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="#" className="hover:text-foreground">About</Link></li>
              <li><Link to="#" className="hover:text-foreground">Blog</Link></li>
              <li><Link to="#" className="hover:text-foreground">Careers</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-mono text-sm font-bold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="#" className="hover:text-foreground">Privacy Policy</Link></li>
              <li><Link to="#" className="hover:text-foreground">Terms of Service</Link></li>
              <li><Link to="/status" className="hover:text-foreground">Status</Link></li>
              <li className="hidden sm:block"><Link to="#" className="hover:text-foreground">Security</Link></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
