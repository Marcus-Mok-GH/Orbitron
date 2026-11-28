import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { CopyButton } from "../components/CopyButton";
import { ProviderIcon } from "../components/ProviderIcon";
import { questModels, type Model } from "../data/models";

/** A spread of labs and price tiers for the homepage index. */
const FEATURED_MODEL_IDS = [
  "openai/gpt-5.4-nano",
  "moonshotai/kimi-k3.1-pro",
  "x-ai/grok-4.6",
  "deepseek/deepseek-v4.1-flash",
  "mistralai/mistral-large-3",
];

const PROVIDER_ACCENT: Record<string, string> = {
  OpenAI: "#10A37F",
  Anthropic: "#D97757",
  Google: "#5E9EFF",
  MiniMax: "#F472B6",
  "Moonshot AI": "#34D399",
  DeepSeek: "#4D6BFE",
  Meta: "#0866FF",
  "Z.ai": "#38BDF8",
  NVIDIA: "#76B900",
  xAI: "#C7D2E5",
  Mistral: "#FBBF24",
  Qwen: "#B78CF9",
  Stealth: "#94A3B8",
  Pollinations: "#F472B6",
};

function formatPerMillion(value: number): string {
  if (value === 0) return "Free";
  return `$${value.toFixed(2)}`;
}

function formatContext(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M`;
  }
  if (tokens >= 1_000) {
    return `${Math.round(tokens / 1_000)}K`;
  }
  return String(tokens);
}

const modelCount = questModels.length;
const labCount = new Set(questModels.map((m) => m.provider)).size;
const maxContext = Math.max(...questModels.map((m) => m.contextWindow));
const featuredModels = FEATURED_MODEL_IDS.map((id) =>
  questModels.find((m) => m.id === id)
).filter((m): m is Model => Boolean(m));

const stats = [
  { label: "Models", value: String(modelCount) },
  { label: "Labs", value: String(labCount) },
  { label: "Max context", value: formatContext(maxContext) },
  { label: "Markup", value: "0%" },
];

export default function Landing() {
  const [baseUrl, setBaseUrl] = useState("https://your-deployment.replit.app");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setBaseUrl(window.location.origin);
    }
  }, []);

  const heroCode = `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${baseUrl}/api",
  apiKey: "YOUR_ORBITRON_API_KEY",
});

const response = await client.chat.completions.create({
  model: "openai/gpt-5.4-nano", // Or any model in the index
  messages: [
    { role: "user", content: "Explain quantum gravity" }
  ],
});`;

  return (
    <div className="flex flex-col animate-fade-in">
      <section className="pt-12 sm:pt-32 pb-12 sm:pb-24 px-4 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] opacity-20 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/30 to-blue-500/30 blur-[100px] rounded-full" />
        </div>
        
        <div className="container mx-auto text-center max-w-4xl relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted/50 border border-border text-xs sm:text-sm font-mono text-muted-foreground mb-6 sm:mb-8">
            <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
            OpenAI · Anthropic · Google · one API
          </div>
          
          <h1 className="text-4xl sm:text-5xl md:text-8xl font-bold tracking-tighter mb-6 sm:mb-8 leading-[1.1]">
            One API. <br />
            Every <span className="text-transparent bg-clip-text bg-gradient-to-r from-foreground to-foreground/50">Frontier</span> Model.
          </h1>
          
          <p className="text-base sm:text-xl text-muted-foreground mb-8 sm:mb-12 max-w-2xl mx-auto font-mono text-sm md:text-base leading-relaxed">
            Orbitron is the neutral infrastructure for AI. Access every frontier model from OpenAI, Anthropic, and Google through a single API key. Transparent per-token pricing. Zero markup.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link to="/signup" className="h-12 sm:h-14 px-6 sm:px-8 inline-flex items-center justify-center rounded-md bg-foreground text-background font-medium hover:bg-foreground/90 transition-colors w-full sm:w-auto text-sm sm:text-base">
              Get your API key
            </Link>
            <Link to="/docs" className="h-12 sm:h-14 px-6 sm:px-8 inline-flex items-center justify-center rounded-md border border-input bg-background font-medium hover:bg-accent hover:text-accent-foreground transition-colors w-full sm:w-auto font-mono text-sm">
              Read Docs
            </Link>
          </div>
          <p className="mt-4 text-xs font-mono text-muted-foreground">
            Starts with $5 in free credits. Already have an account?{" "}
            <Link to="/keys" className="underline hover:text-foreground">Manage your keys →</Link>
          </p>
        </div>
      </section>

      {/* Code Demo Section */}
      <section className="py-12 sm:py-24 border-t border-border/50 bg-muted/10">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12 items-center">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">Standardized across providers.</h2>
              <p className="text-muted-foreground mb-4 sm:mb-6 font-mono text-sm">
                No more learning new SDKs. Orbitron perfectly emulates the OpenAI API format. Just change your base URL and pass the model name.
              </p>
              <ul className="space-y-4 mb-8 font-mono text-sm">
                <li className="flex items-start gap-2 sm:gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary/20 text-primary grid place-items-center mt-0.5 shrink-0">✓</div>
                  Streaming support across all models
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary/20 text-primary grid place-items-center mt-0.5 shrink-0">✓</div>
                  Unified tool calling format
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary/20 text-primary grid place-items-center mt-0.5 shrink-0">✓</div>
                  Automated multimodal format translation
                </li>
              </ul>
            </div>
            
            <div className="rounded-lg sm:rounded-xl border border-border bg-card overflow-hidden shadow-xl sm:shadow-2xl">
              <div className="flex items-center px-4 py-3 border-b border-border bg-muted/30">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <div className="ml-4 font-mono text-xs text-muted-foreground">request.ts</div>
                <div className="ml-auto">
                  <CopyButton text={heroCode} />
                </div>
              </div>
              <div className="p-3 sm:p-6 overflow-x-auto text-xs sm:text-sm font-mono leading-relaxed">
                <pre>
                  <code className="text-muted-foreground">
<span className="text-blue-400">import</span> OpenAI <span className="text-blue-400">from</span> <span className="text-green-400">"openai"</span>;{`\n\n`}
<span className="text-blue-400">const</span> client = <span className="text-blue-400">new</span> OpenAI({`{`}{`\n`}
{'  '}baseURL: <span className="text-green-400">"{baseUrl}/api"</span>,{`\n`}
{'  '}apiKey: <span className="text-green-400">"YOUR_ORBITRON_API_KEY"</span>,{`\n`}
{`}`});{`\n\n`}
<span className="text-blue-400">const</span> response = <span className="text-blue-400">await</span> client.chat.completions.create({`{`}{`\n`}
{'  '}model: <span className="text-green-400">"openai/gpt-5.4-nano"</span>, <span className="text-muted-foreground/50">// Or any model in the index</span>{`\n`}
{'  '}messages: [{`\n`}
{'    '}{`{`} role: <span className="text-green-400">"user"</span>, content: <span className="text-green-400">"Explain quantum gravity"</span> {`}`}{`\n`}
{'  '}],{`\n`}
{`}`});
                  </code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live model index */}
      <section className="relative overflow-hidden border-t border-border/50">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid-faint opacity-70" />
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-72 w-[900px] -translate-x-1/2 rounded-full bg-primary/[0.07] blur-[120px]" />

        <div className="container relative mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <div className="eyebrow flex items-center gap-2">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                </span>
                The model index
              </div>
              <h2 className="mt-4 text-3xl font-bold tracking-tighter sm:text-5xl">
                Every model. <span className="text-muted-foreground">Out in the open.</span>
              </h2>
              <p className="mt-4 font-mono text-sm leading-relaxed text-muted-foreground sm:text-base">
                {modelCount} models from {labCount} labs, all on one OpenAI-compatible endpoint. Per-token pricing
                at list rate, with zero markup.
              </p>
            </div>
            <Link
              to="/pricing"
              className="group inline-flex shrink-0 items-center gap-2 font-mono text-xs uppercase tracking-[0.16em] text-foreground transition-colors hover:text-primary"
            >
              All models &amp; pricing
              <span className="grid size-7 place-items-center rounded-full border border-border transition-colors group-hover:border-primary/40 group-hover:bg-primary/10">
                <ArrowRight className="size-3.5" />
              </span>
            </Link>
          </div>

          <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/70 bg-border/60 sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-background/70 px-4 py-4 backdrop-blur-sm sm:px-5 sm:py-5">
                <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
                  {stat.label}
                </dt>
                <dd className="mt-1 font-mono text-xl font-bold tabular-nums sm:text-2xl">{stat.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {featuredModels.map((model) => {
              const accent = PROVIDER_ACCENT[model.provider] ?? "#94A3B8";
              return (
                <article
                  key={model.id}
                  className="flex flex-col rounded-xl border border-border/70 bg-card/50 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground/20 hover:bg-card sm:p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="grid size-7 shrink-0 place-items-center rounded-md border"
                        style={{
                          color: accent,
                          borderColor: `${accent}33`,
                          backgroundColor: `${accent}14`,
                        }}
                      >
                        <ProviderIcon provider={model.provider} className="size-3.5" />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                          {model.provider}
                        </div>
                        <div className="mt-0.5 font-mono text-[10px] text-muted-foreground/60">
                          {model.modalities.includes("vision") ? "Vision" : "Text"}
                          {model.modalities.includes("tools") ? " · Tools" : ""}
                        </div>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full border border-border bg-background/60 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                      {formatContext(model.contextWindow)} ctx
                    </span>
                  </div>

                  <h3 className="mt-4 text-base font-semibold tracking-tight">{model.name}</h3>
                  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {model.description}
                  </p>

                  <div className="mt-4 flex items-end justify-between gap-3 border-t border-border/60 pt-3">
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground/70">
                        Input / 1M
                      </div>
                      <div className="font-mono text-sm tabular-nums">{formatPerMillion(model.inputPrice)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground/70">
                        Output / 1M
                      </div>
                      <div className="font-mono text-sm tabular-nums">{formatPerMillion(model.outputPrice)}</div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-border bg-card/60 p-5 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <div className="text-base font-semibold tracking-tight">Start with $5 in free credits.</div>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                No card required. Generate a key and make your first call in a minute.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                to="/signup"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
              >
                Get your API key
                <ArrowRight className="size-3.5" />
              </Link>
              <Link
                to="/docs"
                className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-background px-4 font-mono text-sm font-medium transition-colors hover:bg-accent"
              >
                Read the docs
              </Link>
            </div>
          </div>

          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">
            Prices in USD per 1M tokens. Metered per request. List price, no markup.
          </p>
        </div>
      </section>
    </div>
  )
}
