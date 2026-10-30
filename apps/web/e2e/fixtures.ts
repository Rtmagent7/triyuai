import { test as base, expect, type Page, type WebSocketRoute } from "@playwright/test";

type BinanceMock = {
  /** Sends a mini-ticker frame to the page, e.g. tick("BTCUSDT", 101000, 100000). */
  tick: (symbol: string, close: number, open: number) => void;
  connected: Promise<void>;
};

/**
 * Replaces the Binance WebSocket with a controllable fake so live-price tests are
 * deterministic and never depend on the network (or on binance.com being reachable).
 */
const COIN_IMAGE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><circle cx=".5" cy=".5" r=".5" fill="#888"/></svg>`;

const INTERVAL_S: Record<string, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
  "1w": 604800,
  "1M": 2592000,
};
const NOW = Date.UTC(2026, 9, 29) / 1000;
/** Pairs the fake Binance does not list, to exercise the CoinGecko fallback. */
export const UNLISTED = ["XMRUSDT"];

/** Deterministic candles: a seeded walk per symbol, 3000 bars of history at most. */
export function fakeKlines(symbol: string, interval: string, endTime?: number, limit = 1000) {
  const step = INTERVAL_S[interval] ?? 3600;
  const last = Math.floor((endTime ? endTime / 1000 : NOW) / step) * step - (endTime ? step : 0);
  const first = Math.floor(NOW / step) * step - 3000 * step;
  const base = symbol.startsWith("BTC") ? 80_000 : symbol.startsWith("ETH") ? 2_400 : 100;
  const out: (string | number)[][] = [];
  for (let t = Math.max(first, last - (limit - 1) * step); t <= last; t += step) {
    const k = t / step;
    const mid = base * (1 + 0.08 * Math.sin(k / 37) + 0.02 * Math.sin(k / 5));
    const open = mid * (1 + 0.004 * Math.sin(k * 1.7));
    const close = mid * (1 + 0.004 * Math.cos(k * 1.3));
    const high = Math.max(open, close) * 1.003;
    const low = Math.min(open, close) * 0.997;
    out.push([
      t * 1000,
      open.toFixed(2),
      high.toFixed(2),
      low.toFixed(2),
      close.toFixed(2),
      (100 + (k % 50)).toFixed(2),
    ]);
  }
  return out;
}

/** Fear & Greed readings, newest first: 30 days drifting from greed to fear. */
const fakeFearGreed = () => ({
  data: Array.from({ length: 365 }, (_, i) => {
    const value = Math.round(50 + 30 * Math.sin(i / 20) - 20 * (i < 5 ? 1 : 0));
    const label =
      value <= 24
        ? "Extreme Fear"
        : value <= 44
          ? "Fear"
          : value <= 55
            ? "Neutral"
            : value <= 74
              ? "Greed"
              : "Extreme Greed";
    return {
      value: String(value),
      value_classification: label,
      timestamp: String(NOW - i * 86_400),
    };
  }),
});

export const test = base.extend<{
  binance: BinanceMock;
  offlineImages: void;
  klines: void;
  futures: void;
}>({
  // Fear & Greed index and Binance futures data for /insights and /derivatives.
  futures: [
    async ({ page }, use) => {
      const cors = { "access-control-allow-origin": "*" };
      await page.route(/api\.alternative\.me\/fng/, (route) =>
        route.fulfill({ json: fakeFearGreed(), headers: cors }),
      );
      await page.route(/fapi\.binance\.com\//, (route) => {
        const url = new URL(route.request().url());
        const symbol = url.searchParams.get("symbol") ?? "BTCUSDT";
        const limit = Number(url.searchParams.get("limit") ?? 100);
        const p = url.pathname;
        if (p.endsWith("/klines"))
          return route.fulfill({
            json: fakeKlines(symbol, url.searchParams.get("interval") ?? "1h", undefined, limit),
            headers: cors,
          });
        if (p.endsWith("/openInterestHist")) {
          const step = INTERVAL_S[url.searchParams.get("period") ?? "1h"] ?? 3600;
          const last = Math.floor(NOW / step) * step;
          return route.fulfill({
            json: Array.from({ length: limit }, (_, i) => ({
              symbol,
              sumOpenInterestValue: String(7e9 + 2e8 * Math.sin(i / 9) + i * 1e6),
              timestamp: (last - (limit - 1 - i) * step) * 1000,
            })),
            headers: cors,
          });
        }
        if (p.endsWith("/premiumIndex"))
          return route.fulfill({
            json: ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "DOGEUSDT"].map((s, i) => ({
              symbol: s,
              markPrice: s.startsWith("BTC") ? "80000" : s.startsWith("ETH") ? "2400" : "100",
              lastFundingRate: String(0.0001 * (i % 2 ? -1 : 1) * (i + 1)),
              nextFundingTime: (NOW + 3 * 3600) * 1000,
            })),
            headers: cors,
          });
        if (p.endsWith("/openInterest"))
          return route.fulfill({ json: { symbol, openInterest: "90000" }, headers: cors });
        if (p.endsWith("/globalLongShortAccountRatio"))
          return route.fulfill({ json: [{ symbol, longShortRatio: "2.3" }], headers: cors });
        return route.fulfill({ status: 404, json: {}, headers: cors });
      });
      await page.routeWebSocket(/fstream\.binance\.com/, (ws) => {
        const send = (s: string, side: "BUY" | "SELL", price: number, qty: number) =>
          ws.send(
            JSON.stringify({
              e: "forceOrder",
              o: { s, S: side, ap: String(price), z: String(qty), T: NOW * 1000 },
            }),
          );
        send("BTCUSDT", "SELL", 79500, 1.5);
        send("ETHUSDT", "BUY", 2410, 20);
      });
      await use();
    },
    { auto: true },
  ],
  // Candles for the TA chart, served offline; live kline sockets stay silent.
  klines: [
    async ({ page }, use) => {
      await page.route(/binance\.(vision|com)\/api\/v3\/klines/, (route) => {
        const url = new URL(route.request().url());
        const symbol = url.searchParams.get("symbol") ?? "";
        if (UNLISTED.includes(symbol)) {
          return route.fulfill({ status: 400, json: { code: -1121, msg: "Invalid symbol." } });
        }
        const end = url.searchParams.get("endTime");
        return route.fulfill({
          json: fakeKlines(
            symbol,
            url.searchParams.get("interval") ?? "1h",
            end ? Number(end) + 1 : undefined,
          ),
          headers: { "access-control-allow-origin": "*" },
        });
      });
      await page.routeWebSocket(/@kline_/, () => {});
      await use();
    },
    { auto: true },
  ],
  // Coin logos come from CoinGecko's CDN; serving a placeholder keeps runs deterministic
  // (one malformed logo URL in the snapshot makes the CDN hang, stalling networkidle).
  offlineImages: [
    async ({ page }, use) => {
      await page.route(/^https:\/\/(coin-images|assets)\.coingecko\.com\//, (route) =>
        route.fulfill({ contentType: "image/svg+xml", body: COIN_IMAGE }),
      );
      await use();
    },
    { auto: true },
  ],
  binance: async ({ page }, use) => {
    let socket: WebSocketRoute | undefined;
    let resolve!: () => void;
    const connected = new Promise<void>((r) => (resolve = r));
    await page.routeWebSocket(/binance/, (ws) => {
      socket = ws;
      resolve();
    });
    await use({
      connected,
      tick: (s, c, o) =>
        socket?.send(
          JSON.stringify({
            stream: `${s.toLowerCase()}@miniTicker`,
            data: { s, c: String(c), o: String(o) },
          }),
        ),
    });
  },
});

export { expect };

/** Opens the command palette with the platform shortcut. */
export async function openPalette(page: Page) {
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.getByRole("dialog")).toBeVisible();
}

/** Waits until the client has hydrated (persisted stores loaded, MSW ready on first API call). */
export async function hydrated(page: Page) {
  await page.waitForFunction(() => document.readyState === "complete");
  await page.waitForLoadState("networkidle");
}
