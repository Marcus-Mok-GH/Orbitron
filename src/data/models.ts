export type Modality = "text" | "vision" | "audio" | "tools";

export interface Model {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  inputPrice: number; // per 1M tokens
  outputPrice: number; // per 1M tokens
  throughput: number; // tokens/sec
  latency: number; // ms
  modalities: Modality[];
  description: string;
}

export const providers = ["Pollinations"];

export const models: Model[] = [
  // All models below are served through the Pollinations unified AI API
  // (text.pollinations.ai, OpenAI-compatible) using the configured
  // POLLINATIONS_API_KEY. Verified against the live gateway: these are the
  // models the Classic API serves for this key. Premium models not listed
  // here return FREE_LIMIT (402) on the current tier.
  {
    id: "openai-fast",
    name: "GPT-OSS 20B",
    provider: "Pollinations",
    contextWindow: 131072,
    inputPrice: 0.05,
    outputPrice: 0.15,
    throughput: 200,
    latency: 180,
    modalities: ["text", "tools"],
    description: "OpenAI's open-weight GPT-OSS 20B served by Pollinations. Fast, tool-capable everyday workhorse with generous free usage.",
  },
];
