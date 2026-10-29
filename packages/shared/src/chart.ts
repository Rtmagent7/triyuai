/**
 * Zod-free chart helpers shared by the mock API (apps/web) and the real API (apps/api).
 */
import type { ChartRange, LinePoint, OhlcPoint } from "./schemas";

const DAY = 86_400;

export const rangeSeconds: Record<ChartRange, number> = {
  "24h": DAY,
  "7d": 7 * DAY,
  "1m": 30 * DAY,
  "3m": 90 * DAY,
  "1y": 365 * DAY,
  max: Number.POSITIVE_INFINITY,
};

/** `[timestamp, price]` pairs → strictly increasing points (lightweight-charts requires it). */
export function toLine(pts: [number, number][], unit: "s" | "ms" = "s"): LinePoint[] {
  const out: LinePoint[] = [];
  for (const [t, value] of pts) {
    const time = unit === "ms" ? Math.round(t / 1000) : t;
    if (out.length && time <= out[out.length - 1]!.time) continue;
    out.push({ time, value });
  }
  return out;
}

/** Groups consecutive points into ~90 candles; each candle opens at the previous close. */
export function toOhlc(line: LinePoint[], targetCandles = 90): OhlcPoint[] {
  if (line.length < 2) return [];
  const size = Math.max(2, Math.ceil(line.length / targetCandles));
  const out: OhlcPoint[] = [];
  for (let i = 0; i < line.length; i += size) {
    const chunk = line.slice(i, i + size);
    const values = chunk.map((p) => p.value);
    const open = out.length ? out[out.length - 1]!.close : values[0]!;
    const close = values[values.length - 1]!;
    out.push({
      time: chunk[0]!.time,
      open,
      high: Math.max(open, ...values),
      low: Math.min(open, ...values),
      close,
    });
  }
  return out;
}

/** Keeps the trailing window of `range`, measured from the last point. */
export function sliceRange(line: LinePoint[], range: ChartRange) {
  if (range === "max" || !line.length) return line;
  const end = line[line.length - 1]!.time;
  return line.filter((p) => p.time >= end - rangeSeconds[range]);
}
