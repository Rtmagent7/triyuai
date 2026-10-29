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
export const test = base.extend<{ binance: BinanceMock }>({
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
