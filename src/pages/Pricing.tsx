import { Link } from "react-router-dom";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { questModels as models } from "../data/models";

const modelCount = models.length;
const labCount = new Set(models.map((m) => m.provider)).size;

const included = [
  "Every model in the gateway — one key, one balance",
  "Streaming, tool calls, vision and image generation",
  "Drop-in OpenAI SDK compatibility",
  "Live usage and per-request cost tracking",
];

const promises = [
  { label: "Monthly fee", value: "$0" },
  { label: "Markup", value: "0%" },
  { label: "Free credit", value: "$5" },
];

export default function Pricing() {
  return (
    <div className="animate-fade-in">
      <header className="pt-12 sm:pt-28 pb-10 sm:pb-14 px-4 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Pay as you go · no monthly fee
        </div>
        <h1 className="mt-5 text-3xl sm:text-4xl md:text-6xl font-bold tracking-tighter mb-4 sm:mb-6">
          Simple, usage-based pricing.
        </h1>
        <p className="text-sm sm:text-lg text-muted-foreground font-mono leading-relaxed">
          {modelCount} models from {labCount} labs, metered per token at list price. No seats, no markup, no
          subscription. Start with $5 in free credits.
        </p>
      </header>

      <section className="container mx-auto px-4 max-w-5xl mb-12 sm:mb-20">
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1.35fr_1fr]">
          <div className="relative overflow-hidden rounded-xl border-2 border-primary bg-primary/5 p-5 sm:p-8 flex flex-col">
            <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">Start here</span>
              </div>
              <h2 className="mt-3 text-xl sm:text-2xl font-bold tracking-tight">Your $5 goes straight to tokens.</h2>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Create an account, generate a key, and make your first call in a minute. Every request is metered
                against your balance at the model's list price — nothing else.
              </p>

              <dl className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border/70 bg-border/60">
                {promises.map((item) => (
                  <div key={item.label} className="bg-background/70 px-3 py-3 backdrop-blur-sm">
                    <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground/70">
                      {item.label}
                    </dt>
                    <dd className="mt-1 font-mono text-sm font-bold tabular-nums sm:text-base">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="relative mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                to="/signup"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
              >
                Create your account
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                to="/docs"
                className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-background px-5 font-mono text-sm font-medium transition-colors hover:bg-accent"
              >
                Read the docs
              </Link>
            </div>
            <p className="relative mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">
              No card required · Credits never expire
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 sm:p-8">
            <h3 className="text-lg font-bold tracking-tight">What's included</h3>
            <ul className="mt-5 space-y-3 text-sm font-mono text-muted-foreground">
              {included.map((item) => (
                <li key={item} className="flex gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 border-t border-border pt-4">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Your balance is shared across chat, images, and the API. Every request reports its token count and
                exact cost.
              </p>
              <Link
                to="/docs"
                className="mt-3 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-foreground transition-colors hover:text-primary"
              >
                Usage, keys, and API reference
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="model-pricing" className="container mx-auto px-4 max-w-5xl mb-12 sm:mb-20">
        <div className="mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold">Model pricing</h2>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            USD per 1M tokens. Metered per request at list price, with zero markup.
          </p>
        </div>
        <div className="border border-border rounded-lg overflow-hidden bg-card overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[560px]">
            <thead className="bg-muted/30 text-muted-foreground font-mono text-xs uppercase">
              <tr>
                <th className="px-3 sm:px-6 py-3 sm:py-4 font-medium">Model</th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 font-medium text-right">Context</th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 font-medium text-right">Input</th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 font-medium text-right">Output</th>
              </tr>
            </thead>
            <tbody className="divide-y border-border">
              {models.map((m) => (
                <tr key={m.id} className="hover:bg-muted/10 transition-colors">
                  <td className="px-3 sm:px-6 py-3 sm:py-4">
                    <div className="font-medium text-foreground text-sm">{m.name}</div>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5 hidden sm:block">{m.id}</div>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-right font-mono text-muted-foreground whitespace-nowrap text-xs sm:text-sm">
                    {m.contextWindow >= 1000000 ? `${m.contextWindow / 1000000}M` : `${m.contextWindow / 1000}k`}
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-right font-mono whitespace-nowrap text-xs sm:text-sm">
                    {m.inputPrice === 0 ? "Free" : `$${m.inputPrice.toFixed(2)}`}
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-right font-mono whitespace-nowrap text-xs sm:text-sm">
                    {m.outputPrice === 0 ? "Free" : `$${m.outputPrice.toFixed(2)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">
          Prices in USD per 1M tokens · metered per request · no markup
        </p>
      </section>

      <section className="container mx-auto px-4 max-w-5xl pb-12 sm:pb-20">
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card/60 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <div className="text-base font-semibold tracking-tight">Try it with $5 on us.</div>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              One key for all {modelCount} models, metered per token. No card, no subscription.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              to="/signup"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
            >
              Get your API key
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              to="/docs"
              className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-background px-4 font-mono text-sm font-medium transition-colors hover:bg-accent"
            >
              Read the docs
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
