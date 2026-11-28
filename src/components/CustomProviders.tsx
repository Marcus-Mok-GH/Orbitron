import React, { useEffect, useRef, useState } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { listCustomProviders, providerRequest, type CustomProvider } from "../lib/customProviders";

const inputClass = "w-full min-w-0 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary";
const buttonClass = "inline-flex items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed touch-target";

export function CustomProviders() {
  const [providers, setProviders] = useState<CustomProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [apiFormat, setApiFormat] = useState<CustomProvider["apiFormat"]>("openai");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [modelText, setModelText] = useState("");
  const [mode, setMode] = useState<"manual" | "fetch">("manual");
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [busy, setBusy] = useState<"save" | "fetch" | string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const revision = useRef(0);

  useEffect(() => {
    let live = true;
    listCustomProviders()
      .then((body) => { if (live) setProviders(body.data); })
      .catch((err) => { if (live) setError(err.message); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; revision.current++; };
  }, []);

  function clearForm() {
    revision.current++;
    setEditingId(null);
    setName("");
    setBaseUrl("");
    setApiFormat("openai");
    setApiKey("");
    setModelText("");
    setMode("manual");
    setFetchedModels([]);
    setSelectedModels([]);
    setError(null);
  }

  function invalidateModels() {
    revision.current++;
    setFetchedModels([]);
    setSelectedModels([]);
  }

  function edit(provider: CustomProvider) {
    clearForm();
    setNotice(null);
    setEditingId(provider.id);
    setName(provider.name);
    setBaseUrl(provider.baseUrl);
    setApiFormat(provider.apiFormat || "openai");
    setModelText(provider.models.join("\n"));
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function discover() {
    setBusy("fetch");
    setError(null);
    setNotice(null);
    const currentRevision = revision.current;
    try {
      const body = await providerRequest<{ models: string[] }>("/api/custom-providers/discover", {
        method: "POST",
        body: JSON.stringify({ apiFormat, baseUrl: baseUrl.trim(), apiKey: apiKey.trim() || undefined, providerId: editingId }),
      });
      if (currentRevision !== revision.current) return;
      setFetchedModels(body.models);
      setSelectedModels(body.models);
    } catch (err) {
      if (currentRevision === revision.current) setError(err instanceof Error ? err.message : "Could not fetch models.");
    } finally {
      setBusy(null);
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const models = mode === "fetch" ? selectedModels : [...new Set(modelText.split("\n").map((m) => m.trim()).filter(Boolean))];
    if (!models.length) {
      setError(mode === "fetch" ? "Fetch models and select at least one." : "Enter a model name.");
      return;
    }
    setBusy("save");
    setError(null);
    setNotice(null);
    try {
      const result = await providerRequest<{ data: CustomProvider }>(
        "/api/custom-providers" + (editingId ? "/" + editingId : ""), {
          method: editingId ? "PUT" : "POST",
          body: JSON.stringify({ apiFormat, name: name.trim(), baseUrl: baseUrl.trim(), apiKey: apiKey.trim() || undefined, models }),
        },
      );
      setProviders((prev) => editingId
        ? prev.map((p) => p.id === editingId ? result.data : p)
        : [...prev, result.data]);
      clearForm();
      setNotice("Provider saved. Its models are now available in the chat model picker.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save provider.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(provider: CustomProvider) {
    if (!window.confirm(`Remove ${provider.name}? Its models will no longer be available for new requests.`)) return;
    setBusy(provider.id);
    setError(null);
    setNotice(null);
    try {
      await providerRequest("/api/custom-providers/" + provider.id, { method: "DELETE" });
      setProviders((prev) => prev.filter((p) => p.id !== provider.id));
      if (editingId === provider.id) clearForm();
      setNotice("Provider removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove provider.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="custom-provider-heading" className="min-w-0 space-y-4">
      <div>
        <h3 id="custom-provider-heading" className="text-lg font-bold">Custom providers</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect an OpenAI-compatible or Anthropic-compatible provider. Your key is stored encrypted on the server.
          Requests use your provider account; the provider bills you directly.
        </p>
      </div>
      {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive break-words">{error}</p>}
      {notice && <p role="status" className="rounded-md border border-border bg-muted/30 p-3 text-sm">{notice}</p>}
      <form ref={formRef} onSubmit={(event) => void save(event)} className="min-w-0 space-y-4 rounded-lg border border-border bg-card p-3 sm:p-4">
        <h4 className="font-medium">{editingId ? "Edit custom provider" : "Add custom provider"}</h4>
        <fieldset disabled={!!busy || loading} className="min-w-0 space-y-4">
          <label className="block space-y-1.5 text-sm font-medium">
            <span>API format</span>
            <select value={apiFormat} onChange={(e) => { setApiFormat(e.target.value as CustomProvider["apiFormat"]); invalidateModels(); }} className={inputClass}>
              <option value="openai">OpenAI compatible</option>
              <option value="anthropic">Anthropic compatible</option>
            </select>
          </label>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <label className="min-w-0 space-y-1.5 text-sm font-medium">
              <span>Provider name</span>
              <input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="My provider" className={inputClass} />
            </label>
            <label className="min-w-0 space-y-1.5 text-sm font-medium">
              <span>Base URL</span>
              <input required type="url" value={baseUrl} onChange={(e) => { setBaseUrl(e.target.value); invalidateModels(); }} placeholder={apiFormat === "anthropic" ? "https://api.anthropic.com" : "https://api.example.com/v1"} className={inputClass} />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">{apiFormat === "anthropic" ? "Use the public HTTPS API base URL, with or without /v1. Orbitron uses /v1/models and /v1/messages." : "Use the public HTTPS API base URL, including /v1 if required. Orbitron appends /models or /chat/completions."}</p>
          <label className="block space-y-1.5 text-sm font-medium">
            <span>API key{editingId ? " (leave blank to keep saved key)" : ""}</span>
            <input required={!editingId} type="password" autoComplete="new-password" maxLength={8192} value={apiKey} onChange={(e) => { setApiKey(e.target.value); invalidateModels(); }} placeholder={editingId ? "Saved key is hidden" : "Enter provider API key"} className={inputClass} />
          </label>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm">
              <label className="flex items-center gap-2"><input type="radio" name="custom-model-mode" checked={mode === "manual"} onChange={() => setMode("manual")} />Enter model name</label>
              <label className="flex items-center gap-2"><input type="radio" name="custom-model-mode" checked={mode === "fetch"} onChange={() => setMode("fetch")} />Fetch all models</label>
            </div>
            {mode === "manual" ? (
              <div className="space-y-1.5 text-sm font-medium">
                <label htmlFor="custom-provider-model">Model name</label>
                <textarea id="custom-provider-model" aria-describedby="custom-provider-model-help" required rows={3} value={modelText} onChange={(e) => setModelText(e.target.value)} placeholder="provider/model-name" className={inputClass + " font-mono"} />
                <p id="custom-provider-model-help" className="text-xs font-normal text-muted-foreground">Enter the exact model ID. For multiple models, use one per line. Manual entry does not verify model availability.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <button type="button" onClick={() => void discover()} disabled={!baseUrl.trim() || (!apiKey.trim() && !editingId)} className={buttonClass}>
                  {busy === "fetch" && <Loader2 className="h-4 w-4 animate-spin" />}Fetch models
                </button>
                <p className="text-xs text-muted-foreground">Uses the provider's /models endpoint. If unsupported, enter a model name instead.</p>
                {fetchedModels.length > 0 && (
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input type="checkbox" checked={selectedModels.length === fetchedModels.length} onChange={(e) => setSelectedModels(e.target.checked ? fetchedModels : [])} />
                      Select all ({selectedModels.length}/{fetchedModels.length})
                    </label>
                    <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border border-border p-3">
                      {fetchedModels.map((model) => (
                        <label key={model} className="flex items-start gap-2 text-sm">
                          <input type="checkbox" className="mt-1 shrink-0" checked={selectedModels.includes(model)} onChange={(e) => setSelectedModels((prev) => e.target.checked ? [...prev, model] : prev.filter((id) => id !== model))} />
                          <span className="min-w-0 break-all font-mono">{model}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={buttonClass + " bg-primary text-primary-foreground hover:bg-primary/90"}>
              {busy === "save" && <Loader2 className="h-4 w-4 animate-spin" />}{editingId ? "Save changes" : "Save provider"}
            </button>
            {editingId && <button type="button" onClick={clearForm} className={buttonClass}>Cancel edit</button>}
          </div>
        </fieldset>
      </form>
      {loading && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading saved providers…</p>}
      {providers.map((provider) => (
        <div key={provider.id} className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="min-w-0">
            <h4 className="break-words font-medium">{provider.name}</h4>
            <p className="break-all text-xs text-muted-foreground">{provider.baseUrl}</p>
            <p className="mt-1 text-xs text-muted-foreground">{provider.apiFormat === "anthropic" ? "Anthropic compatible" : "OpenAI compatible"} · {provider.models.length} model{provider.models.length === 1 ? "" : "s"} · API key saved</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" disabled={!!busy} onClick={() => edit(provider)} aria-label={"Edit " + provider.name} className={buttonClass}><Pencil className="h-4 w-4" />Edit</button>
            <button type="button" disabled={!!busy} onClick={() => void remove(provider)} aria-label={"Remove " + provider.name} className={buttonClass}><Trash2 className="h-4 w-4" />Remove</button>
          </div>
        </div>
      ))}
    </section>
  );
}
