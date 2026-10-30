"use client";

import { useQueries } from "@tanstack/react-query";
import {
  ColorType,
  CrosshairMode,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
import type { ChartRange, Coin } from "@triyuai/shared";
import { PercentBadge } from "@/components/coin/percent-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/keys";
import { SLOT_COLORS } from "@/lib/compare";

const css = (name: string) =>
  typeof window === "undefined"
    ? ""
    : getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Each coin's price as % change from the first point of the range, on one scale. */
export function PerformanceChart({
  ids,
  coins,
  range,
}: {
  ids: string[];
  coins: Coin[];
  range: ChartRange;
}) {
  const { resolvedTheme } = useTheme();
  const box = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<"Line">[]>([]);
  const charts = useQueries({
    queries: ids.map((id) => ({
      queryKey: queryKeys.chart(id, range),
      queryFn: () => api.chart(id, range),
      staleTime: 5 * 60_000,
    })),
  });
  const normalised = charts.map((q) => {
    const line = q.data?.data.line ?? [];
    const base = line[0]?.value;
    return base
      ? line.map((p) => ({ time: p.time as UTCTimestamp, value: (p.value / base - 1) * 100 }))
      : [];
  });
  const loading = charts.some((q) => q.isPending);
  const key = charts.map((q) => q.dataUpdatedAt).join(",");

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const c = createChart(el, {
      autoSize: true,
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      handleScroll: { vertTouchDrag: false },
      localization: { priceFormatter: (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%` },
    });
    chartRef.current = c;
    return () => {
      c.remove();
      chartRef.current = null;
      series.current = [];
    };
  }, []);

  useEffect(() => {
    chartRef.current?.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: css("--muted"),
        fontFamily: "var(--font-inter), system-ui, sans-serif",
        attributionLogo: false,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: css("--border") } },
    });
  }, [resolvedTheme]);

  useEffect(() => {
    const c = chartRef.current;
    if (!c) return;
    series.current.forEach((s) => c.removeSeries(s));
    series.current = normalised.map((data, i) => {
      const s = c.addSeries(LineSeries, {
        color: SLOT_COLORS[i],
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
      });
      s.setData(data);
      return s;
    });
    c.timeScale().fitContent();
    // `key` changes whenever any series' data does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ids.join(",")]);

  return (
    <div>
      <ul
        className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-sm"
        aria-label="Change over the range"
      >
        {ids.map((id, i) => {
          const c = coins.find((x) => x.id === id);
          const last = normalised[i]?.at(-1)?.value;
          return (
            <li key={id} className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-0.5 w-4 rounded"
                style={{ background: SLOT_COLORS[i] }}
              />
              {c?.symbol.toUpperCase() ?? id}
              <PercentBadge value={last ?? null} />
            </li>
          );
        })}
      </ul>
      <div className="relative h-80">
        <div ref={box} className="absolute inset-0" />
        {loading && <Skeleton className="absolute inset-0" />}
      </div>
      {charts.some((q) => q.data?.data.simulated) && (
        <p className="text-muted mt-2 text-xs">
          Some series are simulated from the 7-day sparkline.
        </p>
      )}
    </div>
  );
}
