"use client";

import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import type { ChartRange, ChartType } from "@triyuai/shared";
import { chartRanges } from "@triyuai/shared/constants";
import { ErrorState } from "@/components/common/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useChart } from "@/hooks/queries";
import { useMoney } from "@/hooks/use-money";
import { cn } from "@/lib/utils";
import { PercentBadge } from "./percent-badge";

const rangeLabel: Record<ChartRange, string> = {
  "24h": "24H",
  "7d": "7D",
  "1m": "1M",
  "3m": "3M",
  "1y": "1Y",
  max: "MAX",
};

type Hover = { time: number; price: number; open?: number; high?: number; low?: number } | null;

const css = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** FR-12: TradingView Lightweight Charts with line/candle toggle, ranges and crosshair tooltip. */
export function PriceChart({ coinId }: { coinId: string }) {
  const [range, setRange] = useState<ChartRange>("7d");
  const [type, setType] = useState<ChartType>("line");
  const { data, isPending, isError, refetch, isFetching } = useChart(coinId, range);
  const money = useMoney();
  const rate = money.rates?.[money.currency] ?? 1;
  const { resolvedTheme } = useTheme();
  const container = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | ISeriesApi<"Candlestick"> | null>(null);
  const [hover, setHover] = useState<Hover>(null);
  const priceFormat = useRef(money.price);
  priceFormat.current = money.price;

  const chart = data?.data;
  const first = chart?.line[0]?.value;
  const last = chart?.line.at(-1)?.value;
  const change = first && last ? ((last - first) / first) * 100 : null;
  const up = (change ?? 0) >= 0;

  // Create the chart once.
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const c = createChart(el, {
      autoSize: true,
      crosshair: { mode: CrosshairMode.Magnet },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      handleScroll: { vertTouchDrag: false },
    });
    chartRef.current = c;
    return () => {
      c.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Theme colours come from the CSS design tokens.
  useEffect(() => {
    chartRef.current?.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: css("--muted"),
        fontFamily: "var(--font-inter), system-ui, sans-serif",
        attributionLogo: false,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: css("--border") } },
      localization: { priceFormatter: (usd: number) => priceFormat.current(usd / rate) },
    });
  }, [resolvedTheme, rate]);

  // (Re)build the series when data, type or currency changes.
  useEffect(() => {
    const c = chartRef.current;
    if (!c || !chart) return;
    if (seriesRef.current) {
      c.removeSeries(seriesRef.current);
      seriesRef.current = null;
    }
    const upColor = css("--up");
    const downColor = css("--down");
    if (type === "line") {
      const color = up ? upColor : downColor;
      const s = c.addSeries(AreaSeries, {
        lineColor: color,
        // Tokens are 6-digit hex, so an alpha suffix gives the area fade.
        topColor: `${color}47`,
        bottomColor: `${color}00`,
        lineWidth: 2,
        priceLineVisible: false,
      });
      s.setData(chart.line.map((p) => ({ time: p.time as UTCTimestamp, value: p.value * rate })));
      seriesRef.current = s;
    } else {
      const s = c.addSeries(CandlestickSeries, {
        upColor,
        downColor,
        wickUpColor: upColor,
        wickDownColor: downColor,
        borderVisible: false,
        priceLineVisible: false,
      });
      s.setData(
        chart.ohlc.map((p) => ({
          time: p.time as UTCTimestamp,
          open: p.open * rate,
          high: p.high * rate,
          low: p.low * rate,
          close: p.close * rate,
        })),
      );
      seriesRef.current = s;
    }
    c.timeScale().fitContent();

    const onMove = (param: MouseEventParams<Time>) => {
      const s = seriesRef.current;
      const d = s && param.seriesData.get(s);
      if (!param.time || !d) return setHover(null);
      if ("close" in d)
        setHover({
          time: Number(param.time),
          price: d.close / rate,
          open: d.open / rate,
          high: d.high / rate,
          low: d.low / rate,
        });
      else if ("value" in d) setHover({ time: Number(param.time), price: d.value / rate });
    };
    c.subscribeCrosshairMove(onMove);
    return () => c.unsubscribeCrosshairMove(onMove);
  }, [chart, type, rate, up, resolvedTheme]);

  const showSkeleton = isPending || (isFetching && !chart);

  return (
    <div className="border-border rounded-2xl border p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-h-11" aria-live="polite">
          {hover ? (
            <>
              <p className="tabular text-lg font-semibold">{money.price(hover.price)}</p>
              <p className="text-muted tabular text-xs">
                {new Date(hover.time * 1000).toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
                {hover.open != null && (
                  <>
                    {" "}
                    · O {money.price(hover.open)} H {money.price(hover.high)} L{" "}
                    {money.price(hover.low)}
                  </>
                )}
              </p>
            </>
          ) : chart ? (
            <>
              <p className="text-muted text-sm">{rangeLabel[range]} change</p>
              <PercentBadge value={change} className="text-lg" />
            </>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Chart type"
            value={type}
            onChange={(v) => setType(v as ChartType)}
            options={[
              { value: "line", label: "Line" },
              { value: "ohlc", label: "Candles" },
            ]}
          />
          <Segmented
            label="Range"
            value={range}
            onChange={(v) => setRange(v as ChartRange)}
            options={chartRanges.map((r) => ({ value: r, label: rangeLabel[r] }))}
          />
        </div>
      </div>

      <div className="relative mt-4 h-[300px] sm:h-[380px]">
        <div
          ref={container}
          className={cn("absolute inset-0", (showSkeleton || isError) && "invisible")}
        />
        {showSkeleton && <Skeleton className="absolute inset-0 rounded-xl" />}
        {isError && !chart && (
          <ErrorState
            message="The chart could not be loaded."
            onRetry={() => void refetch()}
            className="absolute inset-0"
          />
        )}
      </div>
      {chart?.simulated && (
        <p className="text-muted mt-2 text-[11px]">
          Prototype: history for this coin is simulated from its 7-day trend. Real history arrives
          with the backend.
        </p>
      )}
      {range === "max" && !chart?.simulated && (
        <p className="text-muted mt-2 text-[11px]">
          MAX shows the last 365 days available in the prototype snapshot.
        </p>
      )}
    </div>
  );
}

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="bg-surface-2 inline-flex rounded-lg p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "text-muted hover:text-text rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            value === o.value && "bg-bg text-text shadow-sm",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
