"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  FG_BANDS,
  fearGreedSnapshot,
  fetchFearGreed,
  fgAgo,
  fgBand,
  fgTone,
  type FearGreedPoint,
} from "@/lib/market/fear-greed";
import { cn } from "@/lib/utils";

const toneText = { down: "text-down", up: "text-up", neutral: "text-text" } as const;

/** Band fills, fear to greed: the data colours at a strength that grows toward the extremes. */
const BAND_FILL = [
  "var(--down)",
  "color-mix(in srgb, var(--down) 45%, var(--surface-2))",
  "var(--surface-2)",
  "color-mix(in srgb, var(--up) 45%, var(--surface-2))",
  "var(--up)",
];

const RANGES = { "30D": 30, "90D": 90, "1Y": 365 } as const;
type Range = keyof typeof RANGES;

export function useFearGreed() {
  const q = useQuery({
    queryKey: ["fear-greed"],
    queryFn: ({ signal }) => fetchFearGreed(365, signal),
    staleTime: 30 * 60_000,
    retry: 1,
  });
  return { points: q.data ?? fearGreedSnapshot, live: !!q.data, loading: q.isPending };
}

/** Crypto Fear & Greed Index: today's reading on a gauge, recent readings, and its history. */
export function FearGreedCard({ className }: { className?: string }) {
  const { points, live, loading } = useFearGreed();
  const [range, setRange] = useState<Range>("90D");
  const now = points[0];
  if (!now) return null;

  return (
    <Card className={cn("flex flex-col gap-5 p-5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">Fear &amp; Greed Index</h2>
        <span className="text-muted text-xs" suppressHydrationWarning>
          {loading ? "Loading…" : live ? "Updated daily" : "Saved reading"} ·{" "}
          {new Date(now.time * 1000).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            timeZone: "UTC",
          })}
        </span>
      </div>

      <div className="grid items-center gap-6 sm:grid-cols-[minmax(0,15rem)_1fr]">
        <Gauge value={now.value} />
        <dl className="grid grid-cols-3 gap-3 sm:grid-cols-1 sm:gap-2">
          {(
            [
              ["Yesterday", 1],
              ["Last week", 7],
              ["Last month", 30],
            ] as const
          ).map(([label, days]) => {
            const p = fgAgo(points, days);
            return (
              <div
                key={label}
                className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between"
              >
                <dt className="text-muted text-xs">{label}</dt>
                <dd className="text-sm">
                  {p ? (
                    <>
                      <span className={cn("tabular font-semibold", toneText[fgTone(p.value)])}>
                        {p.value}
                      </span>{" "}
                      <span className="text-muted text-xs">{fgBand(p.value).label}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
      <p className="sr-only">
        Today: {now.value}, {fgBand(now.value).label}.
      </p>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-muted text-xs">History</h3>
          <div role="radiogroup" aria-label="History range" className="flex gap-1">
            {(Object.keys(RANGES) as Range[]).map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={range === r}
                onClick={() => setRange(r)}
                className={cn(
                  "relative px-1.5 py-0.5 text-xs font-medium",
                  range === r
                    ? "text-text after:bg-brand after:absolute after:inset-x-1.5 after:-bottom-px after:h-px"
                    : "text-muted hover:text-text",
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <History points={points.slice(0, RANGES[range])} />
      </div>
      <p className="text-muted text-xs">
        Index by alternative.me: 0 is extreme fear, 100 extreme greed. Built from volatility,
        momentum, social media, Bitcoin dominance and search trends.
      </p>
    </Card>
  );
}

/** Half-circle gauge in five bands with a needle at the value. */
function Gauge({ value }: { value: number }) {
  const r = 80;
  const cx = 100;
  const cy = 96;
  const at = (v: number, rad = r) => {
    const a = Math.PI * (1 - v / 100);
    return [cx + rad * Math.cos(a), cy - rad * Math.sin(a)] as const;
  };
  let from = 0;
  const arcs = FG_BANDS.map((b, i) => {
    const to = b.max === 100 ? 100 : b.max + 0.5;
    const [x1, y1] = at(from + 0.6);
    const [x2, y2] = at(to - 0.6);
    from = to;
    return (
      <path
        key={b.label}
        d={`M${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2}`}
        stroke={BAND_FILL[i]}
        strokeWidth={14}
        fill="none"
      />
    );
  });
  const [nx, ny] = at(value, r - 22);
  const tone = fgTone(value);
  return (
    <figure className="relative mx-auto w-full max-w-60">
      <svg viewBox="0 0 200 108" className="w-full" aria-hidden>
        {arcs}
        <line
          x1={cx}
          y1={cy}
          x2={nx}
          y2={ny}
          stroke="var(--text)"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={4} fill="var(--text)" />
      </svg>
      <figcaption className="-mt-1 text-center">
        <span className={cn("tabular block text-4xl font-semibold leading-none", toneText[tone])}>
          {value}
        </span>
        <span className="mt-1 block text-sm font-medium">{fgBand(value).label}</span>
      </figcaption>
    </figure>
  );
}

/** Daily readings as a line over the fear (≤ 25) and greed (≥ 75) zones. */
function History({ points }: { points: FearGreedPoint[] }) {
  const series = useMemo(() => [...points].reverse(), [points]);
  const w = 600;
  const h = 120;
  if (series.length < 2) return null;
  const x = (i: number) => (i / (series.length - 1)) * w;
  const y = (v: number) => h - (v / 100) * h;
  const d = series
    .map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`)
    .join("");
  const first = series[0]!;
  const last = series.at(-1)!;
  const fmt = (t: number) =>
    new Date(t * 1000).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  return (
    <figure>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="h-28 w-full"
        role="img"
        aria-label={`Fear and Greed from ${first.value} to ${last.value}`}
      >
        <rect
          x={0}
          y={y(25)}
          width={w}
          height={h - y(25)}
          fill="color-mix(in srgb, var(--down) 10%, transparent)"
        />
        <rect
          x={0}
          y={0}
          width={w}
          height={y(75)}
          fill="color-mix(in srgb, var(--up) 10%, transparent)"
        />
        <line
          x1={0}
          x2={w}
          y1={y(50)}
          y2={y(50)}
          stroke="var(--border)"
          strokeDasharray="4 4"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={d}
          fill="none"
          stroke="var(--text)"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <figcaption className="text-muted tabular mt-1 flex justify-between text-[11px]">
        <span>{fmt(first.time)}</span>
        <span>
          <span className="text-down">Fear ≤ 25</span> · <span className="text-up">Greed ≥ 75</span>
        </span>
        <span>{fmt(last.time)}</span>
      </figcaption>
    </figure>
  );
}
