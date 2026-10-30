/** Colour palette and helpers for chart drawings and indicator styles. */

const GRAYS = [
  "#ffffff",
  "#d1d4dc",
  "#b2b5be",
  "#9598a1",
  "#787b86",
  "#5d606b",
  "#434651",
  "#2a2e39",
  "#131722",
  "#000000",
];

/** Base hues, one column each (TradingView-like). */
const HUES = [
  "#f23645", // red
  "#ff9800", // orange
  "#ffeb3b", // yellow
  "#4caf50", // green
  "#089981", // teal
  "#00bcd4", // cyan
  "#2962ff", // blue
  "#673ab7", // indigo
  "#9c27b0", // purple
  "#e91e63", // pink
];

const toRgb = (hex: string) => {
  const n = parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};
const toHex = (r: number, g: number, b: number) =>
  `#${[r, g, b]
    .map((v) =>
      Math.round(Math.max(0, Math.min(255, v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;

/** Mixes `hex` towards `target` by `t` (0 = unchanged, 1 = target). */
export function mix(hex: string, target: string, t: number) {
  const [r, g, b] = toRgb(hex);
  const [r2, g2, b2] = toRgb(target);
  return toHex(r + (r2 - r) * t, g + (g2 - g) * t, b + (b2 - b) * t);
}

/** Rows: grays, then light tints → base → dark shades of every hue (10 × 8 swatches). */
export const PALETTE: string[][] = [
  GRAYS,
  ...[0.75, 0.55, 0.35, 0.15].map((t) => HUES.map((h) => mix(h, "#ffffff", t))),
  HUES,
  ...[0.25, 0.45].map((t) => HUES.map((h) => mix(h, "#000000", t))),
];

export const isHex = (v: string) => /^#[0-9a-f]{6}$/i.test(v);

/** Accepts "abc", "#abc", "aabbcc" or "#aabbcc"; returns lowercase #rrggbb or null. */
export function normalizeHex(input: string): string | null {
  let v = input.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(v)) v = [...v].map((c) => c + c).join("");
  return /^[0-9a-f]{6}$/.test(v) ? `#${v}` : null;
}

export function withAlpha(color: string, a: number) {
  if (!isHex(color)) return color;
  const [r, g, b] = toRgb(color);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export type LineDash = "solid" | "dashed" | "dotted";

/** Canvas dash pattern scaled to the line width. */
export const dashPattern = (dash: LineDash | undefined, width: number) =>
  dash === "dashed" ? [width * 4, width * 3] : dash === "dotted" ? [width, width * 2] : [];
