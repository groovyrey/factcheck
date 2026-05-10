import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type FetchUrlTextOptions = {
  maxChars?: number;
  timeoutMs?: number;
};

type UrlValidation =
  | { ok: true; url: URL }
  | { ok: false; error: string };

const DEFAULT_MAX_CHARS = 20_000;
const DEFAULT_TIMEOUT_MS = 12_000;

export async function fetchUrlText(rawUrl: string, opts: FetchUrlTextOptions = {}) {
  const maxChars = typeof opts.maxChars === "number" ? opts.maxChars : DEFAULT_MAX_CHARS;
  const timeoutMs = typeof opts.timeoutMs === "number" ? opts.timeoutMs : DEFAULT_TIMEOUT_MS;

  const parsed = validateOutboundUrl(rawUrl);
  if (!parsed.ok) return `Error: ${parsed.error}`;

  const initialUrl = parsed.url;
  if (!(await isPublicHostname(initialUrl.hostname))) {
    return "Error: Refusing to fetch private or local addresses.";
  }

  const response = await fetchWithTimeout(initialUrl.toString(), timeoutMs);
  if (!response.ok) return `Error fetching URL: ${response.status} ${response.statusText}`;

  // Validate final destination after redirects.
  if (!isSafeHttpUrl(response.url)) {
    return "Error: Redirected to an unsafe URL.";
  }
  const finalHost = new URL(response.url).hostname;
  if (!(await isPublicHostname(finalHost))) {
    return "Error: Redirected to a private or local address.";
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
    return `Error: Unsupported content-type: ${contentType || "unknown"}`;
  }

  const text = await readTextWithLimit(response, Math.max(1_000, maxChars * 8));
  const cleanedText = stripHtml(text);
  return cleanedText.slice(0, maxChars);
}

export async function fetchUrlTextBestEffort(rawUrl: string, opts: FetchUrlTextOptions = {}) {
  const text = await fetchUrlText(rawUrl, opts);
  if (!text.startsWith("Error fetching URL: 403") && !text.startsWith("Error fetching URL: 429") && !text.startsWith("Error fetching URL: 401")) {
    return text;
  }

  // Best-effort reader fallback for sites that block direct fetch.
  const parsed = validateOutboundUrl(rawUrl);
  if (!parsed.ok) return `Error: ${parsed.error}`;
  const jinaUrl = `https://r.jina.ai/${parsed.url.toString()}`;
  const response = await fetchWithTimeout(jinaUrl, typeof opts.timeoutMs === "number" ? opts.timeoutMs : DEFAULT_TIMEOUT_MS);
  if (!response.ok) return `Error fetching URL: ${response.status} ${response.statusText}`;
  const text2 = await readTextWithLimit(response, Math.max(1_000, (typeof opts.maxChars === "number" ? opts.maxChars : DEFAULT_MAX_CHARS) * 8));
  const cleanedText2 = stripHtml(text2);
  return cleanedText2.slice(0, typeof opts.maxChars === "number" ? opts.maxChars : DEFAULT_MAX_CHARS);
}

export function validateOutboundUrl(rawUrl: string): UrlValidation {
  const trimmed = rawUrl.trim();
  if (!trimmed) return { ok: false, error: "URL is required." };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: "Invalid URL." };
  }

  if (!isSafeHttpUrl(url.toString())) return { ok: false, error: "Only http/https URLs are allowed." };
  if (url.username || url.password) return { ok: false, error: "Credentials in URL are not allowed." };

  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    return { ok: false, error: "Localhost URLs are not allowed." };
  }

  return { ok: true, url };
}

function isSafeHttpUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

async function isPublicHostname(hostname: string): Promise<boolean> {
  const host = hostname.toLowerCase();

  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return false;

  // If hostname is already an IP, validate directly.
  if (isIP(host)) return !isPrivateIp(host);

  // Resolve to all addresses and reject if any are private/reserved.
  const addrs = await lookup(host, { all: true, verbatim: true });
  return addrs.every((a) => !isPrivateIp(a.address));
}

function isPrivateIp(ip: string): boolean {
  // Handle IPv4-mapped IPv6: ::ffff:127.0.0.1
  const v4Mapped = ip.toLowerCase().startsWith("::ffff:") ? ip.slice("::ffff:".length) : null;
  if (v4Mapped && isIP(v4Mapped) === 4) return isPrivateIpv4(v4Mapped);

  const family = isIP(ip);
  if (family === 4) return isPrivateIpv4(ip);
  if (family === 6) return isPrivateIpv6(ip.toLowerCase());
  return true;
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;

  const [a, b] = parts;

  // RFC1918, loopback, link-local, CGNAT, and "this network".
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10

  return false;
}

function isPrivateIpv6(ip: string): boolean {
  // Loopback / unspecified
  if (ip === "::1" || ip === "::") return true;
  // Link-local fe80::/10
  if (ip.startsWith("fe8") || ip.startsWith("fe9") || ip.startsWith("fea") || ip.startsWith("feb")) return true;
  // Unique local fc00::/7 (fcxx, fdxx)
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true;
  // Multicast ff00::/8
  if (ip.startsWith("ff")) return true;
  return false;
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
      },
      redirect: "follow",
    });
  } finally {
    clearTimeout(timer);
  }
}

async function readTextWithLimit(response: Response, maxBytes: number): Promise<string> {
  const body = response.body;
  if (!body) return "";

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let out = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    bytesRead += value.byteLength;
    if (bytesRead > maxBytes) {
      out += decoder.decode(value, { stream: true });
      break;
    }
    out += decoder.decode(value, { stream: true });
  }

  out += decoder.decode();
  try {
    reader.cancel();
  } catch {
    // ignore
  }
  return out;
}

function stripHtml(text: string): string {
  return text
    .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
    .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

