import { lookup } from "node:dns/promises";
import { isIP, BlockList } from "node:net";
import { request as httpsRequest } from "node:https";
import { Readable } from "node:stream";

const blocked = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10],
  ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16],
  ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 3],
] as const) blocked.addSubnet(address, prefix, "ipv4");

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, "ipv4");
  if (family !== 6 || !/^2[0-9a-f]{3}:/i.test(address)) return false;
  const v6 = new BlockList();
  v6.addSubnet("2001::", 23, "ipv6");
  v6.addSubnet("2001:db8::", 32, "ipv6");
  v6.addSubnet("2002::", 16, "ipv6");
  v6.addSubnet("3fff::", 20, "ipv6");
  return !v6.check(address, "ipv6");
}

export function normalizeProviderUrl(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048) {
    throw new Error("Enter a valid HTTPS base URL.");
  }
  let url: URL;
  try { url = new URL(value.trim()); }
  catch { throw new Error("Enter a valid HTTPS base URL."); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("Use an HTTPS base URL without credentials, a query, or a fragment.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")
    || host.endsWith(".internal") || !host.includes(".") && !isIP(host)
    || isIP(host) && !isPublicAddress(host)) {
    throw new Error("The provider must use a public HTTPS address.");
  }
  return url.toString().replace(/\/+$/, "");
}

export const providerFetch: typeof fetch = async (input, init) => {
  const req = new Request(input, init);
  const url = new URL(req.url);
  const base = new URL(url);
  base.search = "";
  normalizeProviderUrl(base.toString());
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((entry) => !isPublicAddress(entry.address))) {
    throw new Error("The provider must resolve to a public internet address.");
  }
  req.signal.throwIfAborted();
  const body = req.body ? Buffer.from(await req.arrayBuffer()) : undefined;
  const headers = Object.fromEntries(req.headers);
  const target = addresses[0];
  return new Promise<Response>((resolve, reject) => {
    const upstream = httpsRequest(url, {
      method: req.method,
      headers,
      agent: false,
      signal: req.signal,
      lookup: ((_host: string, options: any, callback: any) => {
        if (options?.all) callback(null, [target]);
        else callback(null, target.address, target.family);
      }) as any,
    }, (response) => {
      const responseHeaders = new Headers();
      for (const [key, value] of Object.entries(response.headers)) {
        if (value !== undefined) responseHeaders.set(key, Array.isArray(value) ? value.join(", ") : value);
      }
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400) {
        response.resume();
        reject(new Error("Provider redirects are not supported. Enter the final base URL."));
        return;
      }
      resolve(new Response(Readable.toWeb(response) as ReadableStream<Uint8Array>, {
        status: response.statusCode ?? 502,
        headers: responseHeaders,
      }));
    });
    upstream.setTimeout(60_000, () => upstream.destroy(new Error("Provider request timed out.")));
    upstream.on("error", reject);
    upstream.end(body);
  });
};

export async function readModelPage(response: Response): Promise<{ models: string[]; hasMore: boolean; lastId?: string }> {
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Could not fetch models (provider returned HTTP ${response.status}). Check the base URL and API key, or enter a model manually.`);
  }
  if (!response.body) throw new Error("The provider returned an empty model list.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > 2_000_000) throw new Error("The model list is too large. Enter a model manually.");
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel();
  }
  let body: any;
  try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new Error("The provider did not return a compatible model list."); }
  if (!Array.isArray(body?.data)) throw new Error("The provider did not return a compatible model list.");
  const models = [...new Set<string>(body.data
    .filter((m: any) => typeof m?.id === "string" && m.id.trim() && m.id.length <= 200)
    .map((m: any) => m.id.trim()))].sort();
  if (!models.length) throw new Error("No models were returned. Enter a model manually.");
  if (models.length > 1000) throw new Error("More than 1,000 models were returned. Enter a model manually.");
  return { models, hasMore: body.has_more === true, lastId: typeof body.last_id === "string" ? body.last_id : undefined };
}

export async function readModelIds(response: Response): Promise<string[]> {
  const page = await readModelPage(response);
  if (page.hasMore) throw new Error("This provider paginates its models. Enter a model manually.");
  return page.models;
}
