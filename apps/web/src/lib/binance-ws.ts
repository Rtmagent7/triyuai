/**
 * Binance public mini-ticker stream (FR-09). No API key needed; connects
 * straight from the browser. Reconnects with exponential backoff and reports
 * "failed" after repeated errors so the caller can fall back to polling.
 */
export type MiniTicker = { symbol: string; price: number; change24h: number };

type Options = {
  symbols: string[];
  onTicks: (ticks: MiniTicker[]) => void;
  onStatus: (status: "connecting" | "open" | "failed") => void;
  maxRetries?: number;
};

/**
 * data-stream.binance.vision is Binance's market-data-only host; it stays reachable on
 * networks that block binance.com (e.g. Indonesian ISPs). Retries alternate hosts.
 */
const ENDPOINTS = [
  "wss://data-stream.binance.vision/stream",
  "wss://stream.binance.com:9443/stream",
];

/** Stablecoins and wrapped/staked tokens don't have a meaningful XXX/USDT market. */
const NO_USDT_PAIR = new Set([
  "USDT",
  "USDC",
  "USDS",
  "DAI",
  "FDUSD",
  "USDE",
  "PYUSD",
  "USD1",
  "TUSD",
  "USDTB",
  "BUIDL",
  "USDF",
  "STETH",
  "WSTETH",
  "WBTC",
  "WETH",
  "WEETH",
  "WBETH",
  "CBBTC",
  "BSC-USD",
  "SUSDE",
  "LBTC",
  "RETH",
  "LEO",
  "FIGR_HELOC",
]);

export const binanceSymbol = (symbol: string) =>
  NO_USDT_PAIR.has(symbol.toUpperCase()) ? null : `${symbol.toUpperCase()}USDT`;

export function connectMiniTicker({ symbols, onTicks, onStatus, maxRetries = 5 }: Options) {
  let ws: WebSocket | null = null;
  let retries = 0;
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let buffer: MiniTicker[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | undefined;

  // Batch ticks so React re-renders at most ~2×/s instead of on every message.
  const flush = () => {
    flushTimer = undefined;
    if (buffer.length) onTicks(buffer);
    buffer = [];
  };

  const open = () => {
    if (closed || !symbols.length) return;
    onStatus("connecting");
    const streams = symbols.map((s) => `${s.toLowerCase()}@miniTicker`).join("/");
    try {
      ws = new WebSocket(`${ENDPOINTS[retries % ENDPOINTS.length]}?streams=${streams}`);
    } catch {
      scheduleRetry();
      return;
    }
    ws.onopen = () => {
      retries = 0;
      onStatus("open");
    };
    ws.onmessage = (msg) => {
      try {
        const { data } = JSON.parse(String(msg.data)) as {
          data: { s: string; c: string; o: string };
        };
        const price = Number(data.c);
        const openPrice = Number(data.o);
        if (!Number.isFinite(price)) return;
        buffer.push({
          symbol: data.s,
          price,
          change24h: openPrice ? ((price - openPrice) / openPrice) * 100 : 0,
        });
        flushTimer ??= setTimeout(flush, 500);
      } catch {
        /* ignore malformed frames */
      }
    };
    ws.onclose = () => {
      ws = null;
      if (!closed) scheduleRetry();
    };
    ws.onerror = () => ws?.close();
  };

  const scheduleRetry = () => {
    retries += 1;
    if (retries > maxRetries) {
      onStatus("failed");
      return;
    }
    const wait = Math.min(30_000, 1000 * 2 ** (retries - 1)) + Math.random() * 500;
    timer = setTimeout(open, wait);
  };

  open();

  return () => {
    closed = true;
    clearTimeout(timer);
    clearTimeout(flushTimer);
    ws?.close();
  };
}
