import { authFetch } from "./auth";

export interface CustomProvider {
  id: string;
  name: string;
  baseUrl: string;
  models: string[];
}

export function customModelId(providerId: string, model: string): string {
  return "custom/" + providerId + "/" + encodeURIComponent(model);
}

export function parseCustomModelId(value: string): { providerId: string; model: string } | null {
  const match = /^custom\/([0-9a-f-]+)\/(.+)$/i.exec(value);
  if (!match) return null;
  try { return { providerId: match[1], model: decodeURIComponent(match[2]) }; }
  catch { return null; }
}

export async function providerRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await authFetch(url, {
    ...options,
    headers: { Accept: "application/json", "Content-Type": "application/json", ...options?.headers },
  });
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error?.message || "Provider request failed. Please try again.");
  return body as T;
}

export function listCustomProviders(): Promise<{ data: CustomProvider[] }> {
  return providerRequest("/api/custom-providers");
}
