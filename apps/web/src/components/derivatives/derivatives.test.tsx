import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchOpenInterestHistory, fetchPerpStats, streamLiquidations } from "@/lib/market/futures";
import { server } from "@/test/server";
import { renderWithClient } from "@/test/utils";
import { DerivativesView } from "./derivatives-view";
import { FundingTable } from "./funding-table";
import { LiquidationHeatmap } from "./liquidation-heatmap";
import { LiveLiquidations } from "./live-liquidations";

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onopen?: () => void;
  onmessage?: (m: { data: string }) => void;
  onclose?: () => void;
  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }
  close() {
    this.onclose?.();
  }
  liquidate(s: string, side: "BUY" | "SELL", price: number, qty: number) {
    this.onmessage?.({
      data: JSON.stringify({ o: { s, S: side, ap: String(price), z: String(qty), T: 1 } }),
    });
  }
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeWebSocket);
});
afterEach(() => vi.unstubAllGlobals());

describe("Binance futures client", () => {
  it("joins funding, open interest and the long/short ratio per symbol", async () => {
    const stats = await fetchPerpStats(["BTCUSDT", "NOPEUSDT"]);
    expect(stats).toEqual([
      expect.objectContaining({
        symbol: "BTCUSDT",
        fundingRate: 0.0001,
        openInterestUsd: 90000 * 80000,
        longShortRatio: 3,
      }),
    ]);
  });

  it("reports HTTP errors", async () => {
    server.use(
      http.get("https://fapi.binance.com/futures/data/openInterestHist", () =>
        HttpResponse.json({}, { status: 451 }),
      ),
    );
    await expect(fetchOpenInterestHistory("BTCUSDT", "1h", 10)).rejects.toThrow(/451/);
  });

  it("reconnects the liquidation stream until closed", () => {
    vi.useFakeTimers();
    const seen: string[] = [];
    const status: string[] = [];
    const stop = streamLiquidations(
      (l) => seen.push(`${l.symbol}:${l.side}`),
      (s) => status.push(s),
    );
    const ws = FakeWebSocket.instances[0]!;
    ws.onopen?.();
    ws.liquidate("BTCUSDT", "SELL", 80000, 1);
    ws.onmessage?.({ data: "not json" });
    ws.onclose?.();
    vi.advanceTimersByTime(1000);
    expect(FakeWebSocket.instances).toHaveLength(2);
    stop();
    vi.advanceTimersByTime(60_000);
    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(seen).toEqual(["BTCUSDT:long"]);
    expect(status).toContain("open");
  });
});

describe("FundingTable", () => {
  it("shows each perpetual and selects one", async () => {
    const onSelect = vi.fn();
    renderWithClient(
      <FundingTable symbols={["BTCUSDT", "ETHUSDT"]} selected="BTCUSDT" onSelect={onSelect} />,
    );
    const eth = await screen.findByRole("button", { name: /^ETH/ });
    expect(screen.getByText("+0.0100%")).toBeInTheDocument();
    expect(screen.getByText("-0.0050%")).toBeInTheDocument();
    expect(screen.getAllByText("75%")).toHaveLength(2);
    await userEvent.click(eth);
    expect(onSelect).toHaveBeenCalledWith("ETHUSDT");
  });

  it("says when Binance futures is unreachable", async () => {
    server.use(
      http.get("https://fapi.binance.com/fapi/v1/premiumIndex", () => HttpResponse.error()),
    );
    renderWithClient(<FundingTable symbols={["BTCUSDT"]} />);
    expect(await screen.findByText(/couldn.t be reached/)).toBeInTheDocument();
  });
});

describe("LiveLiquidations", () => {
  it("batches incoming liquidations, totals both sides and filters by pair", async () => {
    renderWithClient(<LiveLiquidations symbol="ETHUSDT" />);
    const ws = FakeWebSocket.instances[0]!;
    act(() => ws.onopen?.());
    expect(screen.getByText("Binance futures · live")).toBeInTheDocument();
    act(() => {
      ws.liquidate("BTCUSDT", "SELL", 80000, 1);
      ws.liquidate("ETHUSDT", "BUY", 2000, 10);
    });
    const list = screen.getByRole("list", { name: "Recent liquidations" });
    await within(list).findByText("BTC", {}, { timeout: 2000 });
    expect(within(list).getByText("ETH")).toBeInTheDocument();
    // Longs liquidated: one BTC long of 1 × $80,000.
    expect(screen.getByText("Longs liquidated").nextElementSibling).toHaveTextContent("$80K");
    await userEvent.click(screen.getByRole("checkbox", { name: "Only ETH" }));
    expect(within(list).queryByText("BTC")).not.toBeInTheDocument();
  });
});

describe("LiquidationHeatmap", () => {
  it("lists the largest estimated clusters either side of the price", async () => {
    renderWithClient(<LiquidationHeatmap symbol="BTCUSDT" span="7d" />);
    expect(await screen.findByText("Shorts above")).toBeInTheDocument();
    expect(screen.getByText("Longs below")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /liquidation heatmap/i })).toBeInTheDocument();
  });

  it("falls back to spot candles when futures is blocked", async () => {
    server.use(http.get("https://fapi.binance.com/fapi/v1/klines", () => HttpResponse.error()));
    server.use(
      http.get(/binance\.(vision|com)\/api\/v3\/klines/, () =>
        HttpResponse.json(
          Array.from({ length: 50 }, (_, i) => [i * 3600_000, "100", "101", "99", "100.5", "10"]),
        ),
      ),
    );
    renderWithClient(<LiquidationHeatmap symbol="BTCUSDT" span="7d" />);
    expect(await screen.findByText(/spot candles and volume stand in/)).toBeInTheDocument();
  });

  it("explains when no Binance data can be reached", async () => {
    server.use(http.get("https://fapi.binance.com/fapi/v1/klines", () => HttpResponse.error()));
    server.use(http.get(/binance\.(vision|com)\/api\/v3\/klines/, () => HttpResponse.error()));
    renderWithClient(<LiquidationHeatmap symbol="BTCUSDT" span="1d" />);
    expect(
      await screen.findByText(/market data couldn.t be reached/, {}, { timeout: 4000 }),
    ).toBeInTheDocument();
  });
});

describe("DerivativesView", () => {
  it("maps the pair chosen in the select or the funding table", async () => {
    renderWithClient(<DerivativesView />);
    expect(screen.getByRole("heading", { name: "Liquidation heatmap · BTC" })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Pair" }), "SOLUSDT");
    expect(screen.getByRole("heading", { name: "Liquidation heatmap · SOL" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "30D" }));
    expect(screen.getByRole("radio", { name: "30D" })).toHaveAttribute("aria-checked", "true");
    await userEvent.click(await screen.findByRole("button", { name: /^ETH/ }));
    expect(screen.getByRole("heading", { name: "Liquidation heatmap · ETH" })).toBeInTheDocument();
  });
});
