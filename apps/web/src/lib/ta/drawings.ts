/** Drawing tools for the technical-analysis chart: data model and screen-space geometry. */

export type DrawingType = "trendline" | "ray" | "hline" | "fib" | "rect" | "text";
export type DrawingTool = "cursor" | DrawingType;

/** Anchors are stored in chart space (time + price), so drawings survive zoom and timeframe changes. */
export type Anchor = { time: number; price: number };

export type Drawing = {
  id: string;
  type: DrawingType;
  points: Anchor[];
  color: string;
  text?: string;
};

export const pointsNeeded: Record<DrawingType, number> = {
  trendline: 2,
  ray: 2,
  hline: 1,
  fib: 2,
  rect: 2,
  text: 1,
};

export const toolLabel: Record<DrawingTool, string> = {
  cursor: "Cursor",
  trendline: "Trend line",
  ray: "Ray",
  hline: "Horizontal line",
  fib: "Fibonacci retracement",
  rect: "Rectangle",
  text: "Text note",
};

export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] as const;

/** Retracement drawn from p1 to p2: level 0 sits at p2, level 1 back at p1 (TradingView convention). */
export const fibPrice = (p1: Anchor, p2: Anchor, level: number) =>
  p2.price + (p1.price - p2.price) * level;

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

export type Hit = { part: "body" } | { part: "handle"; index: number };

const HANDLE_R = 7;
const LINE_TOL = 6;

/**
 * Hit test in pixels. `pts` are the drawing's anchors converted to screen space;
 * `textBox` is the measured label box for text notes.
 */
export function hitTest(
  d: Drawing,
  pts: Pt[],
  p: Pt,
  width: number,
  textBox?: { w: number; h: number },
): Hit | null {
  for (let i = 0; i < pts.length; i++) {
    if (Math.hypot(p.x - pts[i]!.x, p.y - pts[i]!.y) <= HANDLE_R)
      return { part: "handle", index: i };
  }
  const [a, b] = pts;
  if (!a) return null;
  switch (d.type) {
    case "trendline":
      return b && distToSegment(p, a, b) <= LINE_TOL ? { part: "body" } : null;
    case "ray":
      return b && distToSegment(p, a, rayEnd(a, b, width)) <= LINE_TOL ? { part: "body" } : null;
    case "hline":
      return Math.abs(p.y - a.y) <= LINE_TOL ? { part: "body" } : null;
    case "rect":
    case "fib": {
      if (!b) return null;
      const [x1, x2] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
      const [y1, y2] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];
      const inside =
        p.x >= x1 - LINE_TOL &&
        p.x <= x2 + LINE_TOL &&
        p.y >= y1 - LINE_TOL &&
        p.y <= y2 + LINE_TOL;
      return inside ? { part: "body" } : null;
    }
    case "text": {
      const box = textBox ?? { w: 80, h: 22 };
      return p.x >= a.x && p.x <= a.x + box.w && p.y >= a.y - box.h && p.y <= a.y
        ? { part: "body" }
        : null;
    }
  }
}

/** Moves a whole drawing by a time/price delta, or one anchor to a new position. */
export function moveDrawing(d: Drawing, hit: Hit, from: Anchor, to: Anchor): Drawing {
  if (hit.part === "handle") {
    return { ...d, points: d.points.map((pt, i) => (i === hit.index ? to : pt)) };
  }
  const dt = to.time - from.time;
  const dp = to.price - from.price;
  return { ...d, points: d.points.map((pt) => ({ time: pt.time + dt, price: pt.price + dp })) };
}
