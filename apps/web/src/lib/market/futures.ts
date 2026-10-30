import type { Bar } from "@/lib/ta/indicators";

/**
 * Binance USDⓈ-M futures public market data: no key, CORS-enabled. Used for the
 * liquidation heatmap, the live liquidation feed and the funding / open interest table.
 */
const FAPI = "https://fapi.binance.com";
const FSTREAM = "wss://fstream.binance.com/ws";

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${FAPI}${path}`, { signal });
  if (!res.ok) throw new Error(`Binance futures: HTTP ${res.status} on ${path.split("?")[0]}`);
  return (await res.json()) as T;
}

export const HEATMAP_WINDOWS = {
  "1d": { label: "24H", interval: "5m", limit: 288 },
  "3d": { label: "3D", interval: "15m", limit: 288 },
  "7d": { label: "7D", interval: "1h", limit: 168 },
  "30d": { label: "30D", interval: "4h", limit: 180 },
} as const;
export type HeatmapWindow = keyof typeof HEATMAP_WINDOWS;

export async function fetchFuturesBars(
  symbol: string,
  interval: string,
  limit: number,
  signal?: AbortSignal,
): Promise<Bar[]> {
  const raw = await get<[number, string, string, string, string, string][]>(
    `/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
    signal,
  );
  return raw.map((k) => ({
    time: Math.floor(k[0] / 1000),
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
    volume: Number(k[5]),
  }));
}

/** Open interest in USD per period (Binance keeps the last 30 days, 500 rows at most). */
export async function fetchOpenInterestHistory(
  symbol: string,
  period: string,
  limit: number,
  signal?: AbortSignal,
): Promise<{ time: number; value: number }[]> {
  const raw = await get<{ sumOpenInterestValue: string; timestamp: number }[]>(
    `/futures/data/openInterestHist?symbol=${symbol}&period=${period}&limit=${Math.min(limit, 500)}`,
    signal,
  );
  return raw.map((r) => ({
    time: Math.floor(r.timestamp / 1000),
    value: Number(r.sumOpenInterestValue),
  }));
}

export type PerpStats = {
  symbol: string;
  markPrice: number;
  /** Last funding rate as a fraction per 8h interval (0.0001 = 0.01%). */
  fundingRate: number;
  nextFundingTime: number;
  openInterestUsd: number | null;
  /** Accounts long ÷ accounts short over the last hour. */
  longShortRatio: number | null;
};

export async function fetchPerpStats(
  symbols: string[],
  signal?: AbortSignal,
): Promise<PerpStats[]> {
  const all = await get<
    { symbol: string; markPrice: string; lastFundingRate: string; nextFundingTime: number }[]
  >("/fapi/v1/premiumIndex", signal);
  const bySymbol = new Map(all.map((p) => [p.symbol, p]));
  return Promise.all(
    symbols
      .filter((s) => bySymbol.has(s))
      .map(async (symbol) => {
        const p = bySymbol.get(symbol)!;
        const mark = Number(p.markPrice);
        const [oi, ls] = await Promise.all([
          get<{ openInterest: string }>(`/fapi/v1/openInterest?symbol=${symbol}`, signal).catch(
            () => null,
          ),
          get<{ longShortRatio: string }[]>(
            `/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=1h&limit=1`,
            signal,
          ).catch(() => null),
        ]);
        return {
          symbol,
          markPrice: mark,
          fundingRate: Number(p.lastFundingRate),
          nextFundingTime: p.nextFundingTime,
          openInterestUsd: oi ? Number(oi.openInterest) * mark : null,
          longShortRatio: ls?.[0] ? Number(ls[0].longShortRatio) : null,
        };
      }),
  );
}

/** A forced liquidation reported by Binance (it sends at most one per symbol per second). */
export type Liquidation = {
  symbol: string;
  /** "long" when a long was closed (a forced SELL), "short" for a forced BUY. */
  side: "long" | "short";
  price: number;
  usd: number;
  time: number;
};

export function parseForceOrder(msg: unknown): Liquidation | null {
  const o = (msg as { o?: { s: string; S: string; ap: string; z: string; T: number } } | null)?.o;
  if (!o) return null;
  const price = Number(o.ap);
  const qty = Number(o.z);
  if (!Number.isFinite(price) || !Number.isFinite(qty) || price <= 0) return null;
  return {
    symbol: o.s,
    side: o.S === "SELL" ? "long" : "short",
    price,
    usd: price * qty,
    time: o.T,
  };
}

/** Streams every liquidation on Binance futures; returns a function that closes the socket. */
export function streamLiquidations(
  onLiquidation: (l: Liquidation) => void,
  onStatus?: (s: "open" | "closed") => void,
) {
  let ws: WebSocket | null = null;
  let closed = false;
  let retry = 0;
  const connect = () => {
    ws = new WebSocket(`${FSTREAM}/!forceOrder@arr`);
    ws.onopen = () => {
      retry = 0;
      onStatus?.("open");
    };
    ws.onmessage = (e) => {
      try {
        const l = parseForceOrder(JSON.parse(String(e.data)));
        if (l) onLiquidation(l);
      } catch {
        // Malformed frame: skip it.
      }
    };
    ws.onclose = () => {
      onStatus?.("closed");
      if (!closed) setTimeout(connect, Math.min(30_000, 1000 * 2 ** retry++));
    };
  };
  connect();
  return () => {
    closed = true;
    ws?.close();
  };
}
