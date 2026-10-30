import type { Bar } from "./indicators";

/**
 * Binance public market data (no API key). `data-api.binance.vision` serves the same
 * klines as api.binance.com but is market-data only and reachable where binance.com is blocked.
 */
const REST = ["https://data-api.binance.vision/api/v3", "https://api.binance.com/api/v3"];
const WS = ["wss://data-stream.binance.vision/ws", "wss://stream.binance.com:9443/ws"];

export const intervals = ["1m", "5m", "15m", "1h", "4h", "1d", "1w", "1M"] as const;
export type Interval = (typeof intervals)[number];

export const intervalLabel: Record<Interval, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1H",
  "4h": "4H",
  "1d": "1D",
  "1w": "1W",
  "1M": "1M",
};

export const intervalSeconds: Record<Interval, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3_600,
  "4h": 14_400,
  "1d": 86_400,
  "1w": 604_800,
  "1M": 2_592_000,
};

/** USDT pair for a coin ticker, e.g. "btc" → "BTCUSDT". Stablecoins quoted in themselves have none. */
export function binanceSymbol(ticker: string): string | null {
  const t = ticker.toUpperCase();
  if (!/^[A-Z0-9]{2,12}$/.test(t) || t === "USDT") return null;
  return `${t}USDT`;
}

/** The pair is not listed on Binance (HTTP 400, code -1121). */
export class PairUnavailableError extends Error {}

type RawKline = [number, string, string, string, string, string, ...unknown[]];

export const parseKline = (k: RawKline): Bar => ({
  time: Math.floor(k[0] / 1000),
  open: Number(k[1]),
  high: Number(k[2]),
  low: Number(k[3]),
  close: Number(k[4]),
  volume: Number(k[5]),
});

/** Up to 1000 bars ending before `endTime` (UNIX seconds), oldest first. */
export async function fetchKlines(
  symbol: string,
  interval: Interval,
  opts: { endTime?: number; limit?: number; signal?: AbortSignal } = {},
): Promise<Bar[]> {
  const qs = new URLSearchParams({ symbol, interval, limit: String(opts.limit ?? 1000) });
  if (opts.endTime) qs.set("endTime", String(opts.endTime * 1000 - 1));
  let lastError: unknown;
  for (const base of REST) {
    try {
      const res = await fetch(`${base}/klines?${qs}`, { signal: opts.signal });
      if (res.status === 400) {
        const body = (await res.json().catch(() => null)) as { code?: number } | null;
        if (body?.code === -1121) throw new PairUnavailableError(symbol);
      }
      if (!res.ok) throw new Error(`Binance responded ${res.status}`);
      return ((await res.json()) as RawKline[]).map(parseKline);
    } catch (err) {
      if (err instanceof PairUnavailableError || (err as Error).name === "AbortError") throw err;
      lastError = err;
    }
  }
  throw lastError;
}

type KlineMessage = {
  e: "kline";
  k: { t: number; o: string; h: string; l: string; c: string; v: string };
};

/**
 * Streams the forming candle. Reconnects with backoff and falls back to the second host.
 * Returns an unsubscribe function.
 */
export function subscribeKlines(symbol: string, interval: Interval, onBar: (bar: Bar) => void) {
  let ws: WebSocket | null = null;
  let attempt = 0;
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const connect = () => {
    if (closed) return;
    const host = WS[attempt % WS.length];
    ws = new WebSocket(`${host}/${symbol.toLowerCase()}@kline_${interval}`);
    ws.onopen = () => (attempt = 0);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as KlineMessage;
        if (msg.e !== "kline") return;
        const { t, o, h, l, c, v } = msg.k;
        onBar(parseKline([t, o, h, l, c, v]));
      } catch {
        /* ignore malformed frames */
      }
    };
    ws.onclose = () => {
      if (closed) return;
      attempt++;
      timer = setTimeout(connect, Math.min(30_000, 1_000 * 2 ** Math.min(attempt, 5)));
    };
  };
  connect();

  return () => {
    closed = true;
    clearTimeout(timer);
    ws?.close();
  };
}

/** Merges a live bar: replaces the forming bar or appends a new one. Returns true if appended. */
export function mergeBar(bars: Bar[], bar: Bar): boolean {
  const last = bars[bars.length - 1];
  if (last && last.time === bar.time) {
    bars[bars.length - 1] = bar;
    return false;
  }
  if (!last || bar.time > last.time) {
    bars.push(bar);
    return true;
  }
  return false;
}
