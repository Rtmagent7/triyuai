/** Drawing tools for the technical-analysis chart: catalogue, data model and screen-space geometry. */

import type { LineDash } from "./colors";

export type DrawingType =
  // Lines
  | "trendline"
  | "ray"
  | "extended"
  | "arrow"
  | "hline"
  | "hray"
  | "vline"
  | "crossline"
  | "channel"
  // Fibonacci
  | "fib"
  | "fibext"
  | "fibtime"
  // Shapes
  | "rect"
  | "ellipse"
  | "triangle"
  | "path"
  | "brush"
  // Notes
  | "text"
  | "callout"
  | "pricelabel"
  | "markup"
  | "markdown"
  // Measure & positions
  | "pricerange"
  | "daterange"
  | "measure"
  | "long"
  | "short";

export type DrawingTool = "cursor" | DrawingType;

export type ToolGroup = "lines" | "fib" | "shapes" | "notes" | "measure";

/** Number of clicks to place a tool; "multi" ends with double-click/Enter, "free" is drag-to-draw. */
export type PointSpec = number | "multi" | "free";

type ToolMeta = {
  label: string;
  group: ToolGroup;
  points: PointSpec;
  hint: string;
  shortcut?: string;
};

/** The tool catalogue, in toolbar order. */
export const TOOLS: Record<DrawingType, ToolMeta> = {
  trendline: {
    label: "Trend line",
    group: "lines",
    points: 2,
    hint: "Two points",
    shortcut: "Alt+T",
  },
  ray: { label: "Ray", group: "lines", points: 2, hint: "Extends past the 2nd point" },
  extended: {
    label: "Extended line",
    group: "lines",
    points: 2,
    hint: "Infinite in both directions",
  },
  arrow: { label: "Arrow", group: "lines", points: 2, hint: "Line with an arrowhead" },
  hline: {
    label: "Horizontal line",
    group: "lines",
    points: 1,
    hint: "Support / resistance",
    shortcut: "Alt+H",
  },
  hray: { label: "Horizontal ray", group: "lines", points: 1, hint: "Level from a point onwards" },
  vline: {
    label: "Vertical line",
    group: "lines",
    points: 1,
    hint: "Mark a moment in time",
    shortcut: "Alt+V",
  },
  crossline: { label: "Cross line", group: "lines", points: 1, hint: "Price and time together" },
  channel: {
    label: "Parallel channel",
    group: "lines",
    points: 3,
    hint: "Two points, then the width",
  },
  fib: {
    label: "Fib retracement",
    group: "fib",
    points: 2,
    hint: "Swing low → swing high",
    shortcut: "Alt+F",
  },
  fibext: { label: "Fib extension", group: "fib", points: 3, hint: "Trend A → B, retrace C" },
  fibtime: { label: "Fib time zones", group: "fib", points: 2, hint: "Start, then one unit" },
  rect: {
    label: "Rectangle",
    group: "shapes",
    points: 2,
    hint: "Zone or range",
    shortcut: "Alt+R",
  },
  ellipse: { label: "Ellipse", group: "shapes", points: 2, hint: "Highlight an area" },
  triangle: { label: "Triangle", group: "shapes", points: 3, hint: "Three corners" },
  path: {
    label: "Path",
    group: "shapes",
    points: "multi",
    hint: "Click points, double-click to finish",
  },
  brush: { label: "Brush", group: "shapes", points: "free", hint: "Drag to draw freely" },
  text: { label: "Text", group: "notes", points: 1, hint: "A note on the chart" },
  callout: {
    label: "Callout",
    group: "notes",
    points: 2,
    hint: "Point at a spot, then place the note",
  },
  pricelabel: { label: "Price label", group: "notes", points: 1, hint: "Tag a price" },
  markup: { label: "Up marker", group: "notes", points: 1, hint: "Bullish signal" },
  markdown: { label: "Down marker", group: "notes", points: 1, hint: "Bearish signal" },
  pricerange: { label: "Price range", group: "measure", points: 2, hint: "Change in price and %" },
  daterange: { label: "Date range", group: "measure", points: 2, hint: "Bars and duration" },
  measure: {
    label: "Measure",
    group: "measure",
    points: 2,
    hint: "Price, %, bars and time",
    shortcut: "Alt+M",
  },
  long: {
    label: "Long position",
    group: "measure",
    points: 2,
    hint: "Entry, then target (stop is draggable)",
  },
  short: {
    label: "Short position",
    group: "measure",
    points: 2,
    hint: "Entry, then target (stop is draggable)",
  },
};

export const GROUPS: { id: ToolGroup; label: string }[] = [
  { id: "lines", label: "Lines" },
  { id: "fib", label: "Fibonacci" },
  { id: "shapes", label: "Shapes" },
  { id: "notes", label: "Notes" },
  { id: "measure", label: "Measure" },
];

export const toolsIn = (group: ToolGroup) =>
  (Object.keys(TOOLS) as DrawingType[]).filter((t) => TOOLS[t].group === group);

export const toolLabel = (t: DrawingTool) => (t === "cursor" ? "Cursor" : TOOLS[t].label);
export const pointsNeeded = (t: DrawingType) => TOOLS[t].points;

/** Anchors are stored in chart space (time + price), so drawings survive zoom and timeframe changes. */
export type Anchor = { time: number; price: number };

export type FibLevel = { value: number; visible: boolean; color?: string };

export type Drawing = {
  id: string;
  type: DrawingType;
  points: Anchor[];
  color: string;
  /** Line width in px (default 2). */
  width?: number;
  dash?: LineDash;
  /** Prevents moving and reshaping (still selectable and deletable). */
  locked?: boolean;
  /** Text notes and callouts. */
  text?: string;
  fontSize?: number;
  /** Shape / band fill ("none" for no fill). */
  fill?: string;
  fillOpacity?: number;
  /** Lines and Fibonacci levels. */
  extendLeft?: boolean;
  extendRight?: boolean;
  /** Price label (horizontal line) or price/percent/bars change (lines). */
  showLabel?: boolean;
  /** Fibonacci levels; defaults per type. */
  levels?: FibLevel[];
};

/** Visual defaults applied to new drawings (the toolbar edits them). */
export type DrawingStyle = { color: string; width: number; dash: LineDash };

export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] as const;

export const FIB_DEFAULT_LEVELS: FibLevel[] = [
  ...FIB_LEVELS.map((value) => ({ value, visible: true })),
  ...[1.272, 1.618, 2.618].map((value) => ({ value, visible: false })),
];

export const FIB_EXT_LEVELS: FibLevel[] = [0, 0.382, 0.618, 1, 1.272, 1.618, 2, 2.618].map(
  (value) => ({
    value,
    visible: true,
  }),
);

/** Fibonacci numbers used by time zones (bars from the start, in units). */
export const FIB_TIME = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89];

/** Each zone gets its own colour (cool to warm as they widen) so neighbours never read as one. */
const FIB_TIME_COLORS = [
  "#8b8d94",
  "#1a9bff",
  "#0ea5e9",
  "#14b8a6",
  "#3fc07a",
  "#84cc16",
  "#eab308",
  "#f59e0b",
  "#e2725b",
  "#f0586e",
  "#ec4899",
];

/** 89 and beyond start off hidden: on most screens they land far past the last candle. */
export const FIB_TIME_LEVELS: FibLevel[] = FIB_TIME.map((value, i) => ({
  value,
  visible: value <= 55,
  color: FIB_TIME_COLORS[i],
}));

export const fibLevels = (d: Drawing) =>
  d.levels ??
  (d.type === "fibext"
    ? FIB_EXT_LEVELS
    : d.type === "fibtime"
      ? FIB_TIME_LEVELS
      : FIB_DEFAULT_LEVELS);

/**
 * Bar positions of Fibonacci time zones. Counted in candles, not seconds, so every zone
 * starts on a candle and keeps its meaning on any timeframe (and across weekend gaps).
 * The first two clicks set the origin and one unit; both snap to whole bars.
 */
export function fibTimeLogicals(from: number, to: number, values: number[]) {
  const origin = Math.round(from);
  const raw = Math.round(to) - origin;
  const unit = raw === 0 ? 1 : raw;
  return values.map((k) => origin + k * unit);
}

/** Next Fibonacci number after the largest zone, for "Add zone". */
export function nextFibTime(levels: FibLevel[]) {
  const vals = [...levels.map((l) => l.value)].sort((a, b) => a - b);
  const [a = 0, b = 1] = vals.slice(-2);
  return vals.length < 2 ? 1 : a + b;
}

/** Types that support each settings section. */
export const hasLine = (t: DrawingType) =>
  !["text", "pricelabel", "markup", "markdown", "long", "short"].includes(t);
export const hasFill = (t: DrawingType) =>
  [
    "rect",
    "ellipse",
    "triangle",
    "channel",
    "fib",
    "fibext",
    "pricerange",
    "daterange",
    "measure",
  ].includes(t);
export const hasText = (t: DrawingType) => t === "text" || t === "callout";
export const hasLevels = (t: DrawingType) => t === "fib" || t === "fibext" || t === "fibtime";
export const canExtend = (t: DrawingType) =>
  ["trendline", "arrow", "channel", "fib", "fibext"].includes(t);
export const hasChangeLabel = (t: DrawingType) =>
  ["trendline", "ray", "extended", "arrow"].includes(t);

/** New drawings get sensible per-type options on top of the current style. */
export function drawingDefaults(type: DrawingType): Partial<Drawing> {
  switch (type) {
    case "rect":
    case "ellipse":
    case "triangle":
    case "channel":
      return { fillOpacity: 0.12 };
    case "fib":
    case "fibext":
      return { fillOpacity: 0.08 };
    case "pricerange":
    case "daterange":
    case "measure":
      return { fillOpacity: 0.14 };
    case "hline":
    case "hray":
    case "pricelabel":
      return { showLabel: true };
    case "text":
    case "callout":
      return { fontSize: 13 };
    case "markup":
      return { color: "#22c55e" };
    case "markdown":
      return { color: "#ef4444" };
    default:
      return {};
  }
}

/** Long/short: the stop sits as far from the entry as the target, on the other side (1:1). */
export function positionPoints(type: "long" | "short", entry: Anchor, target: Anchor): Anchor[] {
  const dist = Math.abs(target.price - entry.price) || Math.abs(entry.price) * 0.02;
  const up = type === "long";
  const tp = up ? entry.price + dist : entry.price - dist;
  const sl = up ? entry.price - dist : entry.price + dist;
  return [entry, { time: target.time, price: tp }, { time: entry.time, price: sl }];
}

/** Retracement drawn from p1 to p2: level 0 sits at p2, level 1 back at p1 (TradingView convention). */
export const fibPrice = (p1: Anchor, p2: Anchor, level: number) =>
  p2.price + (p1.price - p2.price) * level;

/** Trend-based extension: levels projected from C by the A→B move. */
export const fibExtPrice = (a: Anchor, b: Anchor, c: Anchor, level: number) =>
  c.price + (b.price - a.price) * level;

/** Price of the line through a and b at time t. */
export const priceAt = (a: Anchor, b: Anchor, t: number) =>
  b.time === a.time ? a.price : a.price + ((b.price - a.price) * (t - a.time)) / (b.time - a.time);

/** Channel: the parallel line through p3. */
export function channelOffset(points: Anchor[]) {
  const [a, b, c] = points;
  if (!a || !b || !c) return 0;
  return c.price - priceAt(a, b, c.time);
}

export type Pt = { x: number; y: number };

export function distToSegment(p: Pt, a: Pt, b: Pt) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** End point of a ray from a through b, extended to x = width (or the left edge when pointing left). */
export function rayEnd(a: Pt, b: Pt, width: number): Pt {
  if (b.x === a.x) return { x: a.x, y: b.y > a.y ? 1e6 : -1e6 };
  const edge = b.x > a.x ? width : 0;
  return { x: edge, y: a.y + ((b.y - a.y) * (edge - a.x)) / (b.x - a.x) };
}

/** Segment a→b, optionally extended to the left (x = 0) and/or right (x = width) edge. */
export function extendLine(a: Pt, b: Pt, width: number, left = false, right = false): [Pt, Pt] {
  const [l, r] = a.x <= b.x ? [a, b] : [b, a];
  if (l.x === r.x || (!left && !right)) return [a, b];
  const slope = (r.y - l.y) / (r.x - l.x);
  return [
    left ? { x: 0, y: l.y - slope * l.x } : l,
    right ? { x: width, y: r.y + slope * (width - r.x) } : r,
  ];
}

export function pointInPolygon(p: Pt, poly: Pt[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}

export type Hit = { part: "body" } | { part: "handle"; index: number };

const HANDLE_R = 7;
const TOL = 6;

const nearPolyline = (p: Pt, pts: Pt[]) =>
  pts.some((q, i) => i > 0 && distToSegment(p, pts[i - 1]!, q) <= TOL);

const inBox = (p: Pt, a: Pt, b: Pt, pad = TOL) =>
  p.x >= Math.min(a.x, b.x) - pad &&
  p.x <= Math.max(a.x, b.x) + pad &&
  p.y >= Math.min(a.y, b.y) - pad &&
  p.y <= Math.max(a.y, b.y) + pad;

export type HitContext = {
  width: number;
  /** Label box for text-like drawings (bottom-left at the anchor). */
  textBox?: { w: number; h: number };
  /** Screen points of a channel's parallel line (computed by the caller). */
  parallel?: [Pt, Pt];
  /** Screen y of Fibonacci levels / x of time zones. */
  levelYs?: number[];
  levelXs?: number[];
};

/** Hit test in pixels against a drawing whose anchors are already in screen space. */
export function hitTest(d: Drawing, pts: Pt[], p: Pt, ctx: HitContext): Hit | null {
  // Brushes have hundreds of points: they move as a whole only.
  const handles = d.type === "brush" ? [] : pts;
  for (let i = 0; i < handles.length; i++) {
    if (Math.hypot(p.x - handles[i]!.x, p.y - handles[i]!.y) <= HANDLE_R)
      return { part: "handle", index: i };
  }
  const [a, b, c] = pts;
  if (!a) return null;
  const body = { part: "body" } as const;
  const { width } = ctx;
  switch (d.type) {
    case "trendline":
    case "arrow": {
      if (!b) return null;
      const [s, e] = extendLine(a, b, width, d.extendLeft, d.extendRight);
      return distToSegment(p, s, e) <= TOL ? body : null;
    }
    case "ray":
      return b && distToSegment(p, a, rayEnd(a, b, width)) <= TOL ? body : null;
    case "extended": {
      if (!b) return null;
      const [s, e] = extendLine(a, b, width, true, true);
      return distToSegment(p, s, e) <= TOL ? body : null;
    }
    case "hline":
      return Math.abs(p.y - a.y) <= TOL ? body : null;
    case "hray":
      return Math.abs(p.y - a.y) <= TOL && p.x >= a.x - TOL ? body : null;
    case "vline":
      return Math.abs(p.x - a.x) <= TOL ? body : null;
    case "crossline":
      return Math.abs(p.y - a.y) <= TOL || Math.abs(p.x - a.x) <= TOL ? body : null;
    case "channel": {
      if (!b) return null;
      if (distToSegment(p, a, b) <= TOL) return body;
      const par = ctx.parallel;
      if (!par) return null;
      return distToSegment(p, par[0], par[1]) <= TOL || pointInPolygon(p, [a, b, par[1], par[0]])
        ? body
        : null;
    }
    case "fib":
    case "fibext": {
      const ys = ctx.levelYs ?? [];
      if (!ys.length) return null;
      const xs = pts.map((q) => q.x);
      const x1 = d.extendLeft ? 0 : Math.min(...xs);
      const x2 = d.extendRight ? width : Math.max(...xs);
      return p.x >= x1 - TOL &&
        p.x <= x2 + TOL &&
        p.y >= Math.min(...ys) - TOL &&
        p.y <= Math.max(...ys) + TOL
        ? body
        : null;
    }
    case "fibtime":
      return (ctx.levelXs ?? []).some((x) => Math.abs(p.x - x) <= TOL) ? body : null;
    case "rect":
    case "pricerange":
    case "daterange":
    case "measure":
      return b && inBox(p, a, b) ? body : null;
    case "ellipse": {
      if (!b) return null;
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const rx = Math.abs(b.x - a.x) / 2 + TOL;
      const ry = Math.abs(b.y - a.y) / 2 + TOL;
      return ((p.x - cx) / rx) ** 2 + ((p.y - cy) / ry) ** 2 <= 1 ? body : null;
    }
    case "triangle":
      return b && c && (pointInPolygon(p, [a, b, c]) || nearPolyline(p, [a, b, c, a]))
        ? body
        : null;
    case "path":
    case "brush":
      return nearPolyline(p, pts) ? body : null;
    case "long":
    case "short": {
      if (!b || !c) return null;
      const left = Math.min(a.x, b.x);
      const right = Math.max(a.x, b.x);
      const top = Math.min(a.y, b.y, c.y);
      const bottom = Math.max(a.y, b.y, c.y);
      return p.x >= left - TOL && p.x <= right + TOL && p.y >= top - TOL && p.y <= bottom + TOL
        ? body
        : null;
    }
    case "markup":
    case "markdown":
      return Math.abs(p.x - a.x) <= 10 && Math.abs(p.y - a.y) <= 18 ? body : null;
    case "pricelabel":
    case "text":
    case "callout": {
      const box = ctx.textBox ?? { w: 80, h: 22 };
      const at = d.type === "callout" && b ? b : a;
      if (p.x >= at.x && p.x <= at.x + box.w && p.y >= at.y - box.h && p.y <= at.y) return body;
      return d.type === "callout" && b && distToSegment(p, a, b) <= TOL ? body : null;
    }
  }
}

/** Moves a whole drawing by a time/price delta, or one anchor to a new position. */
export function moveDrawing(d: Drawing, hit: Hit, from: Anchor, to: Anchor): Drawing {
  if (d.locked) return d;
  if (hit.part === "handle") {
    // Positions: the stop keeps the entry's time, so only its price moves.
    if ((d.type === "long" || d.type === "short") && d.points.length === 3) {
      const [e, t, s] = d.points as [Anchor, Anchor, Anchor];
      if (hit.index === 0) return { ...d, points: [to, t, { time: to.time, price: s.price }] };
      if (hit.index === 1) return { ...d, points: [e, to, s] };
      return { ...d, points: [e, t, { time: e.time, price: to.price }] };
    }
    return { ...d, points: d.points.map((pt, i) => (i === hit.index ? to : pt)) };
  }
  const dt = to.time - from.time;
  const dp = to.price - from.price;
  return { ...d, points: d.points.map((pt) => ({ time: pt.time + dt, price: pt.price + dp })) };
}

/** "+1,234.50 (+1.52%) · 12 bars" between two anchors. */
export function changeLabel(a: Anchor, b: Anchor, step: number, fmt: (n: number) => string) {
  const diff = b.price - a.price;
  const pct = a.price ? (diff / a.price) * 100 : 0;
  const bars = Math.round((b.time - a.time) / step);
  const sign = diff >= 0 ? "+" : "−";
  return `${sign}${fmt(Math.abs(diff))} (${sign}${Math.abs(pct).toFixed(2)}%) · ${bars} bars`;
}

/** "3d 4h" style duration. */
export function formatDuration(seconds: number) {
  const s = Math.abs(seconds);
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3_600);
  const m = Math.floor((s % 3_600) / 60);
  if (d) return h ? `${d}d ${h}h` : `${d}d`;
  if (h) return m ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

/** Long/short stats: reward and risk in % of entry, and the reward:risk ratio. */
export function positionStats(points: Anchor[]) {
  const [e, t, s] = points as [Anchor, Anchor, Anchor];
  const reward = Math.abs(t.price - e.price);
  const risk = Math.abs(s.price - e.price);
  return {
    targetPct: (reward / e.price) * 100,
    stopPct: (risk / e.price) * 100,
    ratio: risk ? reward / risk : Infinity,
  };
}
