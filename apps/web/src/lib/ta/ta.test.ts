import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/server";
import {
  PairUnavailableError,
  binanceSymbol,
  fetchKlines,
  mergeBar,
  parseKline,
  subscribeKlines,
} from "./binance";
import { fibPrice, hitTest, moveDrawing, rayEnd, distToSegment, type Drawing } from "./drawings";
import {
  bollinger,
  ema,
  heikinAshi,
  macd,
  rsi,
  sma,
  stochastic,
  vwap,
  type Bar,
} from "./indicators";
import { INDICATORS, defaultParams } from "./registry";
import { logicalToTime, timeToLogical } from "./time-index";

const bar = (time: number, close: number, extra: Partial<Bar> = {}): Bar => ({
  time,
  open: close,
  high: close,
  low: close,
  close,
  volume: 1,
  ...extra,
});

describe("indicators", () => {
  it("SMA and EMA (SMA-seeded, like TradingView)", () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
    expect(ema([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
    expect(ema([1, 2], 3)).toEqual([null, null]);
    expect(ema([10, 10, 10, 20], 3)[3]).toBe(15);
  });

  it("Bollinger Bands collapse on flat prices and widen with volatility", () => {
    const flat = bollinger([5, 5, 5, 5], 2, 2);
    expect(flat.upper[3]).toBe(5);
    expect(flat.lower[3]).toBe(5);
    const b = bollinger([1, 3], 2, 2);
    expect(b.mid[1]).toBe(2);
    expect(b.upper[1]).toBe(4); // sd = 1
    expect(b.lower[1]).toBe(0);
  });

  it("RSI matches the StockCharts reference table (Wilder smoothing)", () => {
    const closes = [
      44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61,
      46.28, 46.28, 46.0, 46.03,
    ];
    const r = rsi(closes, 14);
    expect(r[13]).toBeNull();
    // StockCharts prints 70.53 / 66.32 because its sheet rounds the averages; unrounded:
    expect(r[14]).toBeCloseTo(70.46, 2);
    expect(r[15]).toBeCloseTo(66.25, 2);
    expect(r[16]).toBeCloseTo(66.48, 2);
    expect(rsi([1, 2, 3, 4, 5, 6], 3).at(-1)).toBe(100);
    expect(rsi([1, 2], 14)).toEqual([null, null]);
  });

  it("MACD is zero on flat prices and positive in an uptrend", () => {
    const flat = macd(new Array(40).fill(7), 12, 26, 9);
    expect(flat.line.at(-1)).toBe(0);
    expect(flat.hist.at(-1)).toBe(0);
    expect(flat.signal[25 + 8]).toBe(0);
    expect(flat.signal[25 + 7]).toBeNull();
    const up = macd(
      Array.from({ length: 60 }, (_, i) => i),
      12,
      26,
      9,
    );
    expect(up.line.at(-1)!).toBeGreaterThan(0);
  });

  it("Stochastic is 100 at the top of the range and 50 when flat", () => {
    const rising = Array.from({ length: 20 }, (_, i) => bar(i, i, { high: i, low: i - 1 }));
    expect(stochastic(rising, 5, 1, 1).k.at(-1)).toBe(100);
    const flat = Array.from({ length: 10 }, (_, i) => bar(i, 3));
    expect(stochastic(flat, 5, 3, 3).d.at(-1)).toBe(50);
  });

  it("VWAP weights by volume and resets each UTC day", () => {
    const day = 86_400;
    const v = vwap([
      bar(0, 10, { volume: 1 }),
      bar(3600, 20, { volume: 3 }),
      bar(day, 50, { volume: 2 }),
    ]);
    expect(v[1]).toBe(17.5);
    expect(v[2]).toBe(50);
  });

  it("Heikin Ashi averages candles", () => {
    const ha = heikinAshi([
      { time: 0, open: 10, high: 14, low: 8, close: 12, volume: 1 },
      { time: 1, open: 12, high: 16, low: 11, close: 15, volume: 1 },
    ]);
    expect(ha[0]).toMatchObject({ open: 11, close: 11 });
    expect(ha[1]!.open).toBe(11);
    expect(ha[1]!.close).toBe(13.5);
    expect(ha[1]!.high).toBe(16);
  });

  it("every registry entry computes outputs aligned with the bars", () => {
    const bars = Array.from({ length: 80 }, (_, i) =>
      bar(i * 3600, 100 + Math.sin(i / 5) * 10, { high: 115, low: 85, open: 100 }),
    );
    for (const def of Object.values(INDICATORS)) {
      const params = defaultParams(def.type);
      const out = def.compute(
        bars,
        params,
        { id: "x", type: def.type, params },
        { up: "#22c55e", down: "#ef4444" },
      );
      expect(out.length).toBeGreaterThan(0);
      for (const o of out) expect(o.values).toHaveLength(bars.length);
      expect(def.short(params)).toMatch(/\w/);
    }
    const vol = INDICATORS.volume.compute(
      bars,
      [],
      { id: "v", type: "volume", params: [] },
      { up: "#22c55e", down: "#ef4444" },
    );
    expect(vol[0]!.colors![0]).toMatch(/^rgba\(/);
  });
});

describe("drawings geometry", () => {
  const d = (type: Drawing["type"], n = 2): Drawing => ({
    id: "d",
    type,
    color: "#2962ff",
    points: Array.from({ length: n }, (_, i) => ({ time: i, price: i })),
  });

  it("measures distance to a segment and extends rays to the edge", () => {
    expect(distToSegment({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5);
    expect(distToSegment({ x: -3, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5);
    expect(rayEnd({ x: 0, y: 0 }, { x: 10, y: 10 }, 100)).toEqual({ x: 100, y: 100 });
    expect(rayEnd({ x: 50, y: 0 }, { x: 40, y: 10 }, 100)).toEqual({ x: 0, y: 50 });
  });

  it("hits handles first, then bodies, per drawing type", () => {
    const line = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    expect(hitTest(d("trendline"), line, { x: 2, y: 1 }, { width: 500 })).toEqual({
      part: "handle",
      index: 0,
    });
    expect(hitTest(d("trendline"), line, { x: 50, y: 4 }, { width: 500 })).toEqual({
      part: "body",
    });
    expect(hitTest(d("trendline"), line, { x: 150, y: 0 }, { width: 500 })).toBeNull();
    expect(hitTest(d("ray"), line, { x: 300, y: 2 }, { width: 500 })).toEqual({ part: "body" });
    expect(hitTest(d("hline", 1), [{ x: 0, y: 40 }], { x: 400, y: 43 }, { width: 500 })).toEqual({
      part: "body",
    });
    const box = [
      { x: 0, y: 0 },
      { x: 100, y: 50 },
    ];
    expect(hitTest(d("rect"), box, { x: 50, y: 25 }, { width: 500 })).toEqual({ part: "body" });
    expect(hitTest(d("fib"), box, { x: 200, y: 25 }, { width: 500 })).toBeNull();
    expect(
      hitTest(
        d("text", 1),
        [{ x: 10, y: 30 }],
        { x: 40, y: 20 },
        { width: 500, textBox: { w: 60, h: 20 } },
      ),
    ).toEqual({ part: "body" });
    expect(
      hitTest(
        d("text", 1),
        [{ x: 10, y: 30 }],
        { x: 40, y: 40 },
        { width: 500, textBox: { w: 60, h: 20 } },
      ),
    ).toBeNull();
  });

  it("moves a whole drawing or one handle", () => {
    const moved = moveDrawing(
      d("trendline"),
      { part: "body" },
      { time: 0, price: 0 },
      { time: 5, price: 2 },
    );
    expect(moved.points).toEqual([
      { time: 5, price: 2 },
      { time: 6, price: 3 },
    ]);
    const handle = moveDrawing(
      d("trendline"),
      { part: "handle", index: 1 },
      { time: 0, price: 0 },
      { time: 9, price: 9 },
    );
    expect(handle.points).toEqual([
      { time: 0, price: 0 },
      { time: 9, price: 9 },
    ]);
  });

  it("places Fibonacci levels from p2 (0) back to p1 (1)", () => {
    const p1 = { time: 0, price: 100 };
    const p2 = { time: 1, price: 200 };
    expect(fibPrice(p1, p2, 0)).toBe(200);
    expect(fibPrice(p1, p2, 1)).toBe(100);
    expect(fibPrice(p1, p2, 0.5)).toBe(150);
  });
});

describe("time index", () => {
  const times = [100, 200, 300, 500];

  it("maps bar times to indexes and interpolates between bars", () => {
    expect(timeToLogical(times, 200, 100)).toBe(1);
    expect(timeToLogical(times, 250, 100)).toBe(1.5);
    expect(timeToLogical(times, 400, 100)).toBe(2.5); // uneven gap
    expect(logicalToTime(times, 2.5, 100)).toBe(400);
  });

  it("extrapolates beyond the loaded data", () => {
    expect(timeToLogical(times, 700, 100)).toBe(5);
    expect(timeToLogical(times, 0, 100)).toBe(-1);
    expect(logicalToTime(times, 5, 100)).toBe(700);
    expect(logicalToTime(times, -2, 100)).toBe(-100);
    expect(timeToLogical([], 5, 1)).toBe(0);
    expect(logicalToTime([], 5, 1)).toBe(0);
  });

  it("round-trips", () => {
    for (const t of [120, 333, 480, 900])
      expect(logicalToTime(times, timeToLogical(times, t, 100), 100)).toBe(t);
  });
});

describe("Binance client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps tickers to USDT pairs", () => {
    expect(binanceSymbol("btc")).toBe("BTCUSDT");
    expect(binanceSymbol("USDT")).toBeNull();
    expect(binanceSymbol("weird ticker!")).toBeNull();
  });

  it("parses klines and merges live bars", () => {
    const b = parseKline([1_700_000_000_000, "1", "3", "0.5", "2", "10"]);
    expect(b).toEqual({ time: 1_700_000_000, open: 1, high: 3, low: 0.5, close: 2, volume: 10 });
    const bars = [bar(1, 1)];
    expect(mergeBar(bars, bar(1, 5))).toBe(false);
    expect(bars[0]!.close).toBe(5);
    expect(mergeBar(bars, bar(2, 6))).toBe(true);
    expect(mergeBar(bars, bar(0, 9))).toBe(false);
    expect(bars).toHaveLength(2);
  });

  it("fetches klines with endTime paging", async () => {
    let url = "";
    server.use(
      http.get("https://data-api.binance.vision/api/v3/klines", ({ request }) => {
        url = request.url;
        return HttpResponse.json([[60_000, "1", "2", "0.5", "1.5", "7"]]);
      }),
    );
    const bars = await fetchKlines("BTCUSDT", "1h", { endTime: 3600 });
    expect(bars).toEqual([{ time: 60, open: 1, high: 2, low: 0.5, close: 1.5, volume: 7 }]);
    expect(url).toContain("symbol=BTCUSDT");
    expect(url).toContain("interval=1h");
    expect(url).toContain("endTime=3599999");
  });

  it("reports unlisted pairs and falls back to the second host on errors", async () => {
    server.use(
      http.get("https://data-api.binance.vision/api/v3/klines", () =>
        HttpResponse.json({ code: -1121, msg: "Invalid symbol." }, { status: 400 }),
      ),
    );
    await expect(fetchKlines("FOOUSDT", "1d")).rejects.toBeInstanceOf(PairUnavailableError);

    server.use(
      http.get("https://data-api.binance.vision/api/v3/klines", () => HttpResponse.error()),
      http.get("https://api.binance.com/api/v3/klines", () => HttpResponse.json([])),
    );
    await expect(fetchKlines("BTCUSDT", "1d")).resolves.toEqual([]);

    server.use(
      http.get(
        "https://api.binance.com/api/v3/klines",
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    await expect(fetchKlines("BTCUSDT", "1d")).rejects.toThrow("Binance responded 500");
  });

  it("streams the forming candle and reconnects", () => {
    vi.useFakeTimers();
    const sockets: FakeWs[] = [];
    class FakeWs {
      onopen?: () => void;
      onmessage?: (ev: { data: string }) => void;
      onclose?: () => void;
      closed = false;
      constructor(public url: string) {
        sockets.push(this);
      }
      close() {
        this.closed = true;
      }
    }
    vi.stubGlobal("WebSocket", FakeWs);
    const got: Bar[] = [];
    const stop = subscribeKlines("BTCUSDT", "4h", (b) => got.push(b));
    expect(sockets[0]!.url).toBe("wss://data-stream.binance.vision/ws/btcusdt@kline_4h");
    sockets[0]!.onmessage!({
      data: JSON.stringify({
        e: "kline",
        k: { t: 7_200_000, o: "1", h: "2", l: "1", c: "2", v: "3" },
      }),
    });
    sockets[0]!.onmessage!({ data: "not json" });
    expect(got).toEqual([{ time: 7200, open: 1, high: 2, low: 1, close: 2, volume: 3 }]);
    sockets[0]!.onclose!();
    vi.advanceTimersByTime(2_000);
    expect(sockets[1]!.url).toContain("stream.binance.com");
    stop();
    expect(sockets[1]!.closed).toBe(true);
    vi.useRealTimers();
  });
});
