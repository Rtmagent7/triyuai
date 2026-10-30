import snapshot from "@/mocks/fixtures/fear-greed.json";

/** One daily reading of the Crypto Fear & Greed Index (alternative.me), 0–100. */
export type FearGreedPoint = { value: number; label: string; time: number };

const API = "https://api.alternative.me/fng/";

/** Newest first, as the API returns it. Keyless, CORS-enabled, updated once a day. */
export async function fetchFearGreed(limit = 365, signal?: AbortSignal): Promise<FearGreedPoint[]> {
  const res = await fetch(`${API}?limit=${limit}`, { signal });
  if (!res.ok) throw new Error(`Fear & Greed: HTTP ${res.status}`);
  const json = (await res.json()) as {
    data?: { value: string; value_classification: string; timestamp: string }[];
  };
  const points = (json.data ?? []).map((p) => ({
    value: Number(p.value),
    label: p.value_classification,
    time: Number(p.timestamp),
  }));
  if (!points.length || points.some((p) => !Number.isFinite(p.value)))
    throw new Error("Fear & Greed: empty response");
  return points;
}

/** Saved copy, shown when the live index can't be reached. */
export const fearGreedSnapshot = snapshot as FearGreedPoint[];

/** The index's own bands. */
export const FG_BANDS = [
  { max: 24, label: "Extreme Fear" },
  { max: 44, label: "Fear" },
  { max: 55, label: "Neutral" },
  { max: 74, label: "Greed" },
  { max: 100, label: "Extreme Greed" },
] as const;

export const fgBand = (v: number) => FG_BANDS.find((b) => v <= b.max) ?? FG_BANDS[4];

/** Fear reads in the "down" colour, greed in the "up" colour, neutral in plain ink. */
export const fgTone = (v: number): "down" | "up" | "neutral" =>
  v <= 44 ? "down" : v >= 56 ? "up" : "neutral";

/** The reading closest to `daysAgo` days before the newest one. */
export function fgAgo(points: FearGreedPoint[], daysAgo: number) {
  const newest = points[0];
  if (!newest) return undefined;
  const target = newest.time - daysAgo * 86_400;
  return points.reduce((best, p) =>
    Math.abs(p.time - target) < Math.abs(best.time - target) ? p : best,
  );
}
