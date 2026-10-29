import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { binanceSymbol, connectMiniTicker } from "./binance-ws";

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onopen?: () => void;
  onmessage?: (m: { data: string }) => void;
  onclose?: () => void;
  onerror?: () => void;
  closed = false;
  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.onclose?.();
  }
  /* helpers for the test */
  open() {
    this.onopen?.();
  }
  send(s: string, c: string, o: string) {
    this.onmessage?.({ data: JSON.stringify({ data: { s, c, o } }) });
  }
  fail() {
    this.onerror?.();
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeWebSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeWebSocket);
});
afterEach(() => vi.unstubAllGlobals());

const last = () => FakeWebSocket.instances.at(-1)!;

describe("binanceSymbol", () => {
  it("maps tickers to USDT pairs and skips stablecoins/wrapped tokens", () => {
    expect(binanceSymbol("btc")).toBe("BTCUSDT");
    expect(binanceSymbol("USDT")).toBeNull();
    expect(binanceSymbol("wbtc")).toBeNull();
  });
});

describe("connectMiniTicker", () => {
  it("subscribes to combined mini-ticker streams on the market-data host first", () => {
    const disconnect = connectMiniTicker({
      symbols: ["BTCUSDT", "ETHUSDT"],
      onTicks: vi.fn(),
      onStatus: vi.fn(),
    });
    expect(last().url).toBe(
      "wss://data-stream.binance.vision/stream?streams=btcusdt@miniTicker/ethusdt@miniTicker",
    );
    disconnect();
  });

  it("reports status and batches ticks every 500 ms with the 24h change", () => {
    const onTicks = vi.fn();
    const onStatus = vi.fn();
    const disconnect = connectMiniTicker({ symbols: ["BTCUSDT"], onTicks, onStatus });
    expect(onStatus).toHaveBeenLastCalledWith("connecting");
    last().open();
    expect(onStatus).toHaveBeenLastCalledWith("open");

    last().send("BTCUSDT", "110", "100");
    last().send("BTCUSDT", "99", "100");
    expect(onTicks).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(onTicks).toHaveBeenCalledTimes(1);
    expect(onTicks.mock.calls[0]![0]).toEqual([
      { symbol: "BTCUSDT", price: 110, change24h: 10 },
      { symbol: "BTCUSDT", price: 99, change24h: -1 },
    ]);
    disconnect();
  });

  it("ignores malformed frames", () => {
    const onTicks = vi.fn();
    const disconnect = connectMiniTicker({ symbols: ["BTCUSDT"], onTicks, onStatus: vi.fn() });
    last().onmessage?.({ data: "not json" });
    last().send("BTCUSDT", "abc", "1");
    vi.advanceTimersByTime(1000);
    expect(onTicks).not.toHaveBeenCalled();
    disconnect();
  });

  it("reconnects with backoff, alternating hosts, then gives up so the UI can poll", () => {
    const onStatus = vi.fn();
    connectMiniTicker({ symbols: ["BTCUSDT"], onTicks: vi.fn(), onStatus, maxRetries: 2 });
    last().fail();
    expect(FakeWebSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1600);
    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(last().url).toMatch(/^wss:\/\/stream\.binance\.com:9443/);
    last().fail();
    vi.advanceTimersByTime(2600);
    expect(FakeWebSocket.instances).toHaveLength(3);
    last().fail();
    expect(onStatus).toHaveBeenLastCalledWith("failed");
  });

  it("does not reconnect after disconnect", () => {
    const disconnect = connectMiniTicker({
      symbols: ["BTCUSDT"],
      onTicks: vi.fn(),
      onStatus: vi.fn(),
    });
    disconnect();
    vi.advanceTimersByTime(60_000);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("does nothing without symbols", () => {
    connectMiniTicker({ symbols: [], onTicks: vi.fn(), onStatus: vi.fn() });
    expect(FakeWebSocket.instances).toHaveLength(0);
  });
});
