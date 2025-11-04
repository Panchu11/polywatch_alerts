const PROFILE_URL = /^https?:\/\/(?:www\.)?polymarket\.com\/profile\/([a-zA-Z0-9_-]+)/i;
const WALLET = /^0x[a-fA-F0-9]{40}$/;

function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

async function fetchWithRetry(url: string | URL, opts: RequestInit = {}, attempts = 3): Promise<Response> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url.toString(), { ...opts, headers: { "User-Agent": "PolyWatchAlerts/1.0", ...(opts.headers || {}) } });
      if (!res.ok) throw new Error(`${res.status}`);
      return res;
    } catch (e) {
      lastErr = e;
      const backoff = Math.min(1000 * 2 ** i, 5000) + Math.random() * 250;
      // eslint-disable-next-line no-console
      console.log(`fetch retry ${i + 1}/${attempts} for ${url} after error:`, (e as Error).message);
      if (i === attempts - 1) break;
      await sleep(backoff);
    }
  }
  throw lastErr;
}

export function isWallet(s: string): boolean {
  return WALLET.test(s.trim());
}

export async function resolveToAddress(input: string): Promise<string> {
  const text = input.trim();
  if (WALLET.test(text)) return text.toLowerCase();
  const m = PROFILE_URL.exec(text);
  if (!m) throw new Error("Please provide a valid Polymarket profile URL or wallet address.");
  const slug = m[1];
  const url = `https://www.polymarket.com/profile/${slug}`;
  const html = await fetchWithRetry(url, { headers: { "User-Agent": "PolyWatchAlerts/1.0" } }).then(r => r.text());
  // Heuristic: find proxyWallet or baseAddress in HTML
  const walletMatch = html.match(/\"proxyWallet\"\s*:\s*\"(0x[a-fA-F0-9]{40})\"/) || html.match(/\"baseAddress\"\s*:\s*\"(0x[a-fA-F0-9]{40})\"/);
  if (!walletMatch) throw new Error("Could not resolve profile to wallet address.");
  return walletMatch[1].toLowerCase();
}

export interface Trade {
  proxyWallet: string;
  side: "BUY" | "SELL";
  asset: string;
  conditionId: string;
  size: number;
  price: number;
  timestamp: number; // seconds
  title?: string;
  slug?: string;
  eventSlug?: string;
  outcome?: string;
  transactionHash?: string;
}

export async function fetchRecentTrades(address: string, minUsd = 1000, limit = 100): Promise<Trade[]> {
  const u = new URL("https://data-api.polymarket.com/trades");
  u.searchParams.set("user", address);
  u.searchParams.set("limit", String(limit));
  u.searchParams.set("takerOnly", "true");
  // server-side filter by cash notional if supported
  u.searchParams.set("filterType", "CASH");
  u.searchParams.set("filterAmount", String(minUsd));
  const res = await fetchWithRetry(u.toString());
  const data = (await res.json()) as Trade[];
  return Array.isArray(data) ? data : [];
}

export interface ClosedPosition {
  realizedPnl: number;
  closedAt?: number | string;
  updatedAt?: number | string;
  title?: string;
  outcome?: string;
}

export async function fetchClosedPositions(address: string, limit = 200): Promise<ClosedPosition[]> {
  const u = new URL("https://data-api.polymarket.com/closed-positions");
  u.searchParams.set("user", address);
  u.searchParams.set("limit", String(limit));
  const res = await fetchWithRetry(u.toString());
  const data = (await res.json()) as any[];
  if (!Array.isArray(data)) return [];
  return data.map((d) => ({
    realizedPnl: Number(d.realizedPnl ?? 0),
    closedAt: d.closedAt ?? d.updatedAt ?? d.timestamp,
    title: d.title ?? d.marketTitle ?? d.slug,
    outcome: d.outcome,
  }));
}

export async function fetchTopTrades(minUsd = 5000, limit = 100): Promise<Trade[]> {
  const u = new URL("https://data-api.polymarket.com/trades");
  u.searchParams.set("limit", String(limit));
  u.searchParams.set("takerOnly", "true");
  u.searchParams.set("filterType", "CASH");
  u.searchParams.set("filterAmount", String(minUsd));
  const res = await fetchWithRetry(u.toString());
  const data = (await res.json()) as Trade[];
  return Array.isArray(data) ? data : [];
}
