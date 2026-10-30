"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { useMoney } from "@/hooks/use-money";
import {
  HEATMAP_WINDOWS,
  fetchFuturesBars,
  fetchOpenInterestHistory,
  type HeatmapWindow,
} from "@/lib/market/futures";
import {
  alignOpenInterest,
  buildHeatmap,
  topClusters,
  type Heatmap,
} from "@/lib/market/liquidation-model";
import { fetchKlines, type Interval } from "@/lib/ta/binance";
import type { Bar } from "@/lib/ta/indicators";
import { cn } from "@/lib/utils";

/** Sequential ramp, quiet to loud: deep blue, the logo blue, teal, then yellow for the biggest clusters. */
const RAMP: [number, [number, number, number]][] = [
  [0, [10, 30, 70]],
  [0.35, [10, 106, 214]],
  [0.7, [34, 195, 195]],
  [1, [245, 213, 71]],
];

function rampColor(t: number): [number, number, number] {
  for (let i = 1; i < RAMP.length; i++) {
    const [t1, c1] = RAMP[i]!;
    const [t0, c0] = RAMP[i - 1]!;
    if (t <= t1) {
      const k = (t - t0) / (t1 - t0);
      return [0, 1, 2].map((j) => Math.round(c0[j]! + (c1[j]! - c0[j]!) * k)) as [
        number,
        number,
        number,
      ];
    }
  }
  return RAMP.at(-1)![1];
}

/** The colour key under the legend: the same ramp as the cells, low to high. */
const RAMP_KEY = `linear-gradient(to right, ${RAMP.map(([t, c]) => `rgb(${c.join(",")}) ${t * 100}%`).join(",")})`; // taste-skill-ignore: a data key, not decoration

const AXIS = 68;
/** Pair prices are in USDT, so the axis shows plain numbers. */
const axisNum = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 6 });
const FOOT = 22;

export function useHeatmapData(symbol: string, span: HeatmapWindow) {
  return useQuery({
    queryKey: ["liq-heatmap", symbol, span],
    queryFn: async ({ signal }) => {
      const w = HEATMAP_WINDOWS[span];
      const [futures, oi] = await Promise.all([
        fetchFuturesBars(symbol, w.interval, w.limit, signal).catch(() => null),
        fetchOpenInterestHistory(symbol, w.interval, w.limit, signal).catch(() => []),
      ]);
      // Some networks block fapi.binance.com; spot candles from the binance.vision mirror
      // still give the volume-based version of the model.
      const bars =
        futures ?? (await fetchKlines(symbol, w.interval as Interval, { limit: w.limit, signal }));
      const aligned = alignOpenInterest(
        bars.map((b) => b.time),
        oi,
      );
      return {
        bars,
        map: buildHeatmap(bars, aligned),
        usedOpenInterest: oi.length > 0,
        spot: !futures,
      };
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 1,
  });
}

/** Estimated liquidation levels over time, with candles on top and a hover readout. */
export function LiquidationHeatmap({
  symbol,
  span,
  className,
}: {
  symbol: string;
  span: HeatmapWindow;
  className?: string;
}) {
  const q = useHeatmapData(symbol, span);
  const money = useMoney();
  const map = q.data?.map;
  const bars = q.data?.bars;
  const last = bars?.at(-1);

  const clusters = useMemo(() => {
    if (!map || !last) return null;
    const above = new Float64Array(map.shorts.length);
    const below = new Float64Array(map.longs.length);
    map.prices.forEach((p, i) => {
      if (p > last.close) above[i] = map.shorts[i]!;
      else below[i] = map.longs[i]!;
    });
    return {
      above: topClusters(above, map.prices, map.binSize, 4),
      below: topClusters(below, map.prices, map.binSize, 4),
    };
  }, [map, last]);

  return (
    <div className={cn("grid gap-4 xl:grid-cols-[1fr_17rem]", className)}>
      <Card className="relative min-w-0 overflow-hidden p-0">
        {q.isError ? (
          <p className="text-muted flex h-[420px] items-center justify-center p-6 text-center text-sm">
            Binance market data couldn&apos;t be reached. It may be blocked on this network.
          </p>
        ) : map && bars ? (
          <HeatmapCanvas map={map} bars={bars} usd={money.compact} />
        ) : (
          <div className="bg-surface-2 h-[420px] animate-pulse" aria-label="Loading heatmap" />
        )}
      </Card>
      <Card className="space-y-4 p-4 text-sm">
        <h3 className="font-semibold">Largest estimated clusters</h3>
        {clusters && last ? (
          <>
            <ClusterList
              title="Shorts above"
              tone="up"
              items={clusters.above}
              price={last.close}
              format={money}
            />
            <div className="border-border text-muted flex items-center justify-between border-y py-2 text-xs">
              Last price{" "}
              <span className="tabular text-text font-medium">{money.price(last.close)}</span>
            </div>
            <ClusterList
              title="Longs below"
              tone="down"
              items={clusters.below}
              price={last.close}
              format={money}
            />
          </>
        ) : (
          <p className="text-muted text-xs">{q.isError ? "No data." : "Loading…"}</p>
        )}
        <p className="text-muted text-xs">
          {q.data?.spot
            ? "Futures data is blocked on this network, so spot candles and volume stand in. "
            : q.data && !q.data.usedOpenInterest
              ? "Open interest unavailable; traded volume stands in for new positions. "
              : ""}
          A model, not the order book: positions are assumed to open at each candle&apos;s typical
          price with 5–100x leverage, and a level clears once price trades through it.
        </p>
      </Card>
    </div>
  );
}

function ClusterList({
  title,
  tone,
  items,
  price,
  format,
}: {
  title: string;
  tone: "up" | "down";
  items: { price: number; usd: number }[];
  price: number;
  format: ReturnType<typeof useMoney>;
}) {
  return (
    <div>
      <h4 className="text-muted mb-1 text-xs">{title}</h4>
      {items.length ? (
        <ul className="space-y-1">
          {items.map((c) => (
            <li key={c.price} className="tabular flex items-baseline justify-between gap-2">
              <span>{format.price(c.price)}</span>
              <span className="text-muted text-xs">
                {(((c.price - price) / price) * 100).toFixed(1)}%
              </span>
              <span className={cn("ml-auto font-medium", tone === "up" ? "text-up" : "text-down")}>
                {format.compact(c.usd)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted text-xs">None left in range.</p>
      )}
    </div>
  );
}

function HeatmapCanvas({
  map,
  bars,
  usd,
}: {
  map: Heatmap;
  bars: Bar[];
  usd: (v: number) => string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<{ x: number; y: number; col: number; bin: number } | null>(
    null,
  );
  const height = 420;

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Visible price range: the traded range plus a margin, not the model's full ±12% grid.
  const view = useMemo(() => {
    const lo = Math.min(...bars.map((b) => b.low));
    const hi = Math.max(...bars.map((b) => b.high));
    const pad = (hi - lo) * 0.35;
    return {
      min: Math.max(map.prices[0]!, lo - pad),
      max: Math.min(map.prices.at(-1)! + map.binSize, hi + pad),
    };
  }, [bars, map]);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !width) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = width * dpr;
    c.height = height * dpr;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    const css = getComputedStyle(c);
    const text = css.getPropertyValue("--muted").trim() || "#999";
    const up = css.getPropertyValue("--up").trim() || "#3fc07a";
    const down = css.getPropertyValue("--down").trim() || "#f0586e";
    const border = css.getPropertyValue("--border").trim() || "#333";
    ctx.clearRect(0, 0, width, height);

    const plotW = width - AXIS;
    const plotH = height - FOOT;
    // 8px inset top and bottom so the outer axis labels aren't clipped.
    const y = (p: number) => 8 + (plotH - 16) * (1 - (p - view.min) / (view.max - view.min));
    const cols = map.columns.length;
    const cw = plotW / cols;

    // Heat cells. Scaled to the 98th percentile (square root), so a handful of huge
    // clusters doesn't wash everything else out and small levels stay dim.
    const visible: number[] = [];
    map.columns.forEach((col) =>
      col.forEach((v, b) => {
        const p0 = map.prices[b]!;
        if (v > 0 && p0 + map.binSize >= view.min && p0 <= view.max) visible.push(v);
      }),
    );
    visible.sort((a, b) => a - b);
    const ref = visible[Math.floor(visible.length * 0.98)] ?? map.max;
    map.columns.forEach((col, i) => {
      for (let b = 0; b < col.length; b++) {
        const v = col[b]!;
        if (v <= 0) continue;
        const p0 = map.prices[b]!;
        if (p0 + map.binSize < view.min || p0 > view.max) continue;
        const t = Math.min(1, Math.sqrt(v / ref));
        if (t < 0.1) continue;
        const [r, g, bl] = rampColor(t);
        ctx.fillStyle = `rgba(${r},${g},${bl},${0.15 + 0.85 * t})`;
        const y0 = y(p0 + map.binSize);
        ctx.fillRect(i * cw, y0, Math.ceil(cw), Math.ceil(y(p0) - y0));
      }
    });

    // Candles.
    bars.forEach((b, i) => {
      const x = i * cw + cw / 2;
      ctx.strokeStyle = ctx.fillStyle = b.close >= b.open ? up : down;
      ctx.beginPath();
      ctx.moveTo(x, y(b.high));
      ctx.lineTo(x, y(b.low));
      ctx.lineWidth = 1;
      ctx.stroke();
      const top = y(Math.max(b.open, b.close));
      ctx.fillRect(
        x - Math.max(0.5, cw * 0.3),
        top,
        Math.max(1, cw * 0.6),
        Math.max(1, y(Math.min(b.open, b.close)) - top),
      );
    });

    // Price axis and time labels.
    ctx.fillStyle = text;
    ctx.font = "11px Inter, ui-sans-serif, system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = border;
    ctx.beginPath();
    ctx.moveTo(plotW + 0.5, 0);
    ctx.lineTo(plotW + 0.5, plotH);
    ctx.lineTo(0, plotH + 0.5);
    ctx.stroke();
    for (let k = 0; k <= 6; k++) {
      const p = view.min + ((view.max - view.min) * k) / 6;
      ctx.fillText(axisNum.format(p), plotW + 6, y(p));
    }
    ctx.textBaseline = "top";
    const fmt = (t: number) =>
      new Date(t * 1000).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        hour12: false,
        timeZone: "UTC",
      });
    for (const i of [0, Math.floor(cols / 2), cols - 1]) {
      const label = fmt(bars[i]!.time);
      const w = ctx.measureText(label).width;
      ctx.fillText(label, Math.min(Math.max(0, i * cw - w / 2), plotW - w), plotH + 6);
    }
  }, [width, map, bars, view]);

  const readout = useMemo(() => {
    if (!hover) return null;
    const bar = bars[hover.col];
    const col = map.columns[hover.col];
    if (!bar || !col) return null;
    return { bar, price: map.prices[hover.bin]! + map.binSize / 2, usd: col[hover.bin] ?? 0 };
  }, [hover, bars, map]);

  return (
    <div ref={wrap} className="relative">
      <canvas
        ref={canvas}
        style={{ width: "100%", height }}
        role="img"
        aria-label="Estimated liquidation heatmap with price candles"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - r.left;
          const yPx = e.clientY - r.top;
          const plotW = r.width - AXIS;
          const plotH = height - FOOT;
          if (x > plotW || yPx > plotH) return setHover(null);
          const price = view.min + (1 - (yPx - 8) / (plotH - 16)) * (view.max - view.min);
          const bin = Math.floor((price - map.prices[0]!) / map.binSize);
          const col = Math.min(bars.length - 1, Math.floor((x / plotW) * bars.length));
          setHover({ x, y: yPx, col, bin });
        }}
      />
      {hover && readout && (
        <div
          className="border-border bg-bg pointer-events-none absolute z-10 rounded-md border px-2.5 py-1.5 text-xs shadow-sm"
          style={{
            left: Math.min(hover.x + 12, width - AXIS - 170),
            top: Math.max(4, hover.y - 56),
          }}
        >
          <div className="text-muted tabular">
            {new Date(readout.bar.time * 1000).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
              timeZone: "UTC",
            })}{" "}
            UTC
          </div>
          <div className="tabular">Price {axisNum.format(readout.price)} USDT</div>
          <div className="tabular font-medium">Est. liquidations {usd(readout.usd)}</div>
        </div>
      )}
      <div className="text-muted bg-bg/85 absolute left-2 top-2 flex items-center gap-2 rounded px-1.5 py-0.5 text-[11px]">
        Low
        <span
          aria-hidden
          className="h-1.5 w-20 rounded-full"
          style={{
            background: RAMP_KEY,
          }}
        />
        High
      </div>
    </div>
  );
}
