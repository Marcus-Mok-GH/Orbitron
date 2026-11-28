import React, { useCallback, useEffect, useState } from "react";
import {
  User,
  Users,
  Shield,
  Key as KeyIcon,
  Monitor,
  ExternalLink,
  Loader2,
  AlertTriangle,
  Sun,
  Moon,
  Monitor as MonitorIcon,
  Bell,
  BellOff,
  DollarSign,
} from "lucide-react";
import { useAuth, displayNameFor, initialsFor, authFetch } from "../lib/auth";
import { SecuritySettings } from "../components/SecuritySettings";
import { CustomProviders } from "../components/CustomProviders";

interface UserPreferences {
  theme: "light" | "dark" | "system";
  compactMode: boolean;
  defaultModel: string | null;
  emailNotifications: boolean;
  usageAlertThresholdCents: number;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "system",
  compactMode: false,
  defaultModel: null,
  emailNotifications: true,
  usageAlertThresholdCents: 5000,
};

const PREFS_STORAGE_KEY = "orbitron.preferences.v1";

// Load preferences from localStorage or use defaults
function loadLocalPreferences(): UserPreferences {
  try {
    const saved = localStorage.getItem(PREFS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_PREFERENCES, ...parsed };
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_PREFERENCES;
}

// Save preferences to localStorage
function saveLocalPreferences(prefs: UserPreferences): void {
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

const USAGE_THRESHOLD_OPTIONS = [
  { value: 1000, label: "$10" },
  { value: 2500, label: "$25" },
  { value: 5000, label: "$50" },
  { value: 10000, label: "$100" },
  { value: 25000, label: "$250" },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState("profile");
  const { user } = useAuth();

  // Preferences state
  const [preferences, setPreferences] = useState<UserPreferences>(loadLocalPreferences);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Fetch preferences from server when authenticated
  const refreshPreferences = useCallback(async () => {
    try {
      const res = await authFetch("/api/auth/preferences");
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const prefs = await res.json() as UserPreferences;
      setPreferences(prefs);
      setPreferencesError(null);
    } catch (err) {
      setPreferencesError(err instanceof Error ? err.message : "Failed to load preferences");
    }
  }, []);

  // Fetch preferences on mount and when authenticated
  useEffect(() => {
    if (user) {
      void refreshPreferences();
    }
  }, [user, refreshPreferences]);

  // Update a single preference and sync to server
  const updatePreference = async <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ) => {
    const newPrefs = { ...preferences, [key]: value };
    setPreferences(newPrefs);
    saveLocalPreferences(newPrefs); // Optimistic local save

    // If not authenticated, just use localStorage
    if (!user) return;

    setSavingPrefs(true);
    try {
      const res = await authFetch("/api/auth/preferences", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const updated = await res.json() as UserPreferences;
      setPreferences(updated);
      saveLocalPreferences(updated);
    } catch (err) {
      setPreferencesError(err instanceof Error ? err.message : "Failed to save preference");
      // Revert to previous value on error
      setPreferences(preferences);
      saveLocalPreferences(preferences);
    } finally {
      setSavingPrefs(false);
    }
  };

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    if (preferences.theme === "dark") {
      root.classList.add("dark");
    } else if (preferences.theme === "light") {
      root.classList.remove("dark");
    } else {
      // System preference
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  }, [preferences.theme]);

  // Apply compact mode to document
  useEffect(() => {
    const root = document.documentElement;
    if (preferences.compactMode) {
      root.classList.add("compact");
    } else {
      root.classList.remove("compact");
    }
  }, [preferences.compactMode]);

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "org", label: "Organization", icon: Users },
    { id: "security", label: "Security", icon: Shield },
    { id: "byok", label: "Bring Your Own Key", icon: KeyIcon },
    { id: "prefs", label: "Preferences", icon: Monitor },
  ];

  return (
    <div className="flex flex-col h-full animate-fade-in overflow-hidden">
      <header className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-4 border-b border-border">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight mb-4 sm:mb-6">Settings</h1>
        <div className="flex gap-4 sm:gap-6 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex shrink-0 items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="w-4 h-4 shrink-0" /> {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-muted/5 safe-bottom">
        <div className="max-w-2xl">
          {activeTab === "profile" && (
            <div className="space-y-6">
              <div className="flex flex-col items-start gap-4 mb-8 sm:flex-row sm:items-center sm:gap-6">
                {user?.profileImageUrl ? (
                  <img
                    src={user.profileImageUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="w-20 h-20 rounded-full bg-accent object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-accent grid place-items-center font-mono text-2xl font-bold">
                    {user ? initialsFor(user) : "—"}
                  </div>
                )}
                <div className="text-xs font-mono text-muted-foreground max-w-xs">
                  Your avatar comes from your Neon Auth account profile.
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5 font-mono text-muted-foreground">Full Name</label>
                  <input
                    type="text"
                    value={user ? displayNameFor(user) : ""}
                    readOnly
                    className="w-full bg-background border border-border rounded-md px-3 py-2 font-mono text-sm focus:outline-none max-w-md text-muted-foreground cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 font-mono text-muted-foreground">Email Address</label>
                  <input
                    type="email"
                    value={user?.email ?? ""}
                    readOnly
                    placeholder="Not provided by your auth profile"
                    className="w-full bg-background border border-border rounded-md px-3 py-2 font-mono text-sm focus:outline-none max-w-md text-muted-foreground cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 font-mono text-muted-foreground">User ID</label>
                  <input
                    type="text"
                    value={user?.id ?? ""}
                    readOnly
                    className="w-full bg-background border border-border rounded-md px-3 py-2 font-mono text-xs focus:outline-none max-w-md text-muted-foreground cursor-not-allowed"
                  />
                </div>

                <div className="mt-6 p-4 border border-border rounded-md bg-muted/20 max-w-md">
                  <p className="text-xs font-mono text-muted-foreground mb-3">
                    Profile fields are managed by Neon Auth and refresh on every sign-in.
                  </p>
                  <p className="text-xs font-mono text-muted-foreground">
                    Managed by Neon Auth (Managed Better Auth)
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "byok" && (
            <div className="space-y-6">
              <CustomProviders />
              <p className="text-sm text-muted-foreground mb-6">
                Provide your own provider API keys. We'll route requests to these providers using your keys instead of billing you per token. 
                Custom providers above are billed directly by the provider and do not use Orbitron credits.
              </p>
              
              <div className="space-y-4">
                {["OpenAI", "Anthropic", "Google"].map(provider => (
                  <div key={provider} className="p-3 sm:p-4 border border-border rounded-lg bg-card flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center justify-between">
                    <div className="font-medium w-full sm:w-24">{provider}</div>
                    <div className="flex-1">
                      <input 
                        type="password" 
                        placeholder={`Enter ${provider} API Key`}
                        className="w-full bg-background border border-border rounded-md px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50" 
                      />
                    </div>
                    <button className="px-4 py-2 border border-border rounded-md font-medium text-sm hover:bg-muted transition-colors whitespace-nowrap touch-target">
                      Verify & Save
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "org" && (
            <div className="space-y-6">
               <h3 className="text-lg font-bold">Team Members</h3>
                              <div className="border border-border rounded-lg overflow-x-auto bg-card">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/30 text-muted-foreground font-mono text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 font-medium">User</th>
                      <th className="px-4 py-3 font-medium">Role</th>
                      <th className="px-4 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-border">
                    <tr>
                      <td className="px-4 py-3 font-medium">
                        {user ? displayNameFor(user) : "—"}{" "}
                        <span className="text-muted-foreground font-normal">(you)</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">Owner</td>
                      <td className="px-4 py-3 text-right"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <button className="px-4 py-2 border border-border rounded-md font-medium text-sm hover:bg-muted transition-colors">
                Invite Member
              </button>
            </div>
          )}
          
          {activeTab === "prefs" && (
            <div className="space-y-8">
              {/* Display Preferences */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <MonitorIcon className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-lg font-bold">Display</h3>
                </div>

                {/* Theme */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border border-border rounded-lg bg-card">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Sun className="w-4 h-4 text-muted-foreground" />
                      <Moon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">Theme</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        Choose your preferred color scheme
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 bg-muted/40 rounded-md p-1 w-full sm:w-auto">
                    {(["light", "dark", "system"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => void updatePreference("theme", t)}
                        className={`flex-1 sm:flex-none px-3 py-2 sm:py-1.5 text-xs font-medium rounded transition-colors ${
                          preferences.theme === t
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Compact Mode */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border border-border rounded-lg bg-card">
                  <div>
                    <div className="text-sm font-medium">Compact mode</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      Reduce spacing and element sizes for denser layouts
                    </div>
                  </div>
                  <button
                    onClick={() => void updatePreference("compactMode", !preferences.compactMode)}
                    disabled={savingPrefs}
                    className={`relative w-11 h-6 rounded-full transition-colors switch-hit ${
                      preferences.compactMode ? "bg-primary" : "bg-muted"
                    }`}
                    aria-label="Toggle compact mode"
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-background rounded-full shadow transition-transform ${
                        preferences.compactMode ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Default Model */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border border-border rounded-lg bg-card">
                  <div>
                    <div className="text-sm font-medium">Default model</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      Model pre-selected in chat composer
                    </div>
                  </div>
                  <select
                    value={preferences.defaultModel ?? ""}
                    onChange={(e) => void updatePreference("defaultModel", e.target.value || null)}
                    disabled={savingPrefs}
                    className="bg-background border border-border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary min-w-[140px]"
                  >
                    <option value="">None (All models)</option>
                    <option value="gpt-5.5">GPT-5.5</option>
                    <option value="gpt-5.4">GPT-5.4</option>
                    <option value="gpt-5.3-codex">GPT-5.3 Codex</option>
                    <option value="claude-sonnet-4.6">Claude Sonnet 4.6</option>
                    <option value="gemini-3-pro">Gemini 3 Pro</option>
                    <option value="gemini-3-flash">Gemini 3 Flash</option>
                  </select>
                </div>
              </div>

              {/* Notification Preferences */}
              <div className="space-y-4 pt-4 border-t border-border">
                <div className="flex items-center gap-2 mb-4">
                  <Bell className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-lg font-bold">Notifications</h3>
                </div>

                {/* Email Notifications */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border border-border rounded-lg bg-card">
                  <div className="flex items-start gap-3">
                    {preferences.emailNotifications ? (
                      <Bell className="w-4 h-4 mt-0.5 text-primary" />
                    ) : (
                      <BellOff className="w-4 h-4 mt-0.5 text-muted-foreground" />
                    )}
                    <div>
                      <div className="text-sm font-medium">Email notifications</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        Receive important updates and alerts via email
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => void updatePreference("emailNotifications", !preferences.emailNotifications)}
                    disabled={savingPrefs}
                    className={`relative w-11 h-6 rounded-full transition-colors switch-hit ${
                      preferences.emailNotifications ? "bg-primary" : "bg-muted"
                    }`}
                    aria-label="Toggle email notifications"
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-background rounded-full shadow transition-transform ${
                        preferences.emailNotifications ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Usage Alert Threshold */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border border-border rounded-lg bg-card">
                  <div className="flex items-start gap-3">
                    <DollarSign className="w-4 h-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Usage alert threshold</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        Get notified when spending reaches this amount
                      </div>
                    </div>
                  </div>
                  <select
                    value={preferences.usageAlertThresholdCents}
                    onChange={(e) => void updatePreference("usageAlertThresholdCents", parseInt(e.target.value, 10))}
                    disabled={savingPrefs}
                    className="bg-background border border-border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary min-w-[100px]"
                  >
                    {USAGE_THRESHOLD_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Error display */}
              {preferencesError && (
                <div className="border border-yellow-500/40 bg-yellow-500/10 text-yellow-200 rounded-md px-4 py-3 text-sm font-mono flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {preferencesError}
                </div>
              )}

              {/* Saving indicator */}
              {savingPrefs && (
                <div className="text-xs font-mono text-muted-foreground flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Saving...
                </div>
              )}
            </div>
          )}

          {(activeTab === "security") && (
            <SecuritySettings />
          )}
        </div>
      </div>
    </div>
  );
}