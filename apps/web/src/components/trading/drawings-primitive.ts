import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";
import { dashPattern, withAlpha } from "@/lib/ta/colors";
import {
  changeLabel,
  channelOffset,
  extendLine,
  fibExtPrice,
  fibLevels,
  fibPrice,
  formatDuration,
  positionStats,
  rayEnd,
  type Anchor,
  type Drawing,
  type FibLevel,
  type Pt,
} from "@/lib/ta/drawings";

export { withAlpha };

type Target = Parameters<IPrimitivePaneRenderer["draw"]>[0];

export type DrawingsState = {
  drawings: Drawing[];
  /** The drawing being placed (follows the pointer). */
  preview: Drawing | null;
  selectedId: string | null;
  hidden?: boolean;
  toScreen: (a: Anchor) => Pt | null;
  timeZoneXs: (a: Anchor, b: Anchor, values: number[]) => (number | null)[];
  formatPrice: (p: number) => string;
  /** Bar interval in seconds (for "N bars" labels). */
  step: number;
  text: string;
  background: string;
  up: string;
  down: string;
};

const font = (size: number, weight = 500) =>
  `${weight} ${size}px Inter, ui-sans-serif, system-ui, sans-serif`;
const PAD = 6;

let measureCtx: CanvasRenderingContext2D | null = null;
/** Size of a text note's label box, shared by the renderer and hit testing. */
export function textBox(text: string, fontSize = 13) {
  const lines = (text || "Note").split("\n");
  const h = lines.length * Math.round(fontSize * 1.35) + PAD;
  measureCtx ??= document.createElement("canvas").getContext("2d");
  if (!measureCtx)
    return { w: Math.max(...lines.map((l) => l.length)) * fontSize * 0.6 + PAD * 2, h };
  measureCtx.font = font(fontSize);
  return { w: Math.max(...lines.map((l) => measureCtx!.measureText(l).width)) + PAD * 2, h };
}

const timeLabel = (t: number) =>
  new Date(t * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });

/** Small rounded tag; `align` positions it relative to (x, y). */
function tag(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  bg: string,
  align: "left" | "right" | "center" = "left",
  fg = "#fff",
) {
  ctx.setLineDash([]);
  ctx.font = font(11);
  const w = ctx.measureText(text).width + PAD * 2;
  const left = align === "left" ? x : align === "right" ? x - w : x - w / 2;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(left, y - 9, w, 18, 5);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textBaseline = "middle";
  ctx.fillText(text, left + PAD, y);
  return w;
}

function arrowHead(ctx: CanvasRenderingContext2D, from: Pt, to: Pt, size: number) {
  const ang = Math.atan2(to.y - from.y, to.x - from.x);
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - size * Math.cos(ang - 0.45), to.y - size * Math.sin(ang - 0.45));
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - size * Math.cos(ang + 0.45), to.y - size * Math.sin(ang + 0.45));
  ctx.stroke();
}

function drawOne(
  ctx: CanvasRenderingContext2D,
  size: { width: number; height: number },
  d: Drawing,
  s: DrawingsState,
  selected: boolean,
) {
  const { width, height } = size;
  const pts = d.points.map(s.toScreen);
  if (!pts.length || pts.some((p) => !p)) return;
  const P = pts as Pt[];
  const a = P[0]!;
  const b = P[1];
  const c = P[2];
  const [p1, p2, p3] = d.points as [Anchor, Anchor, Anchor];
  const lw = d.width ?? 2;
  const fillAlpha = d.fillOpacity ?? 0.12;
  const fillColor = d.fill && d.fill !== "none" ? d.fill : d.color;

  const stroke = (dash = d.dash, color = d.color, w = lw) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.setLineDash(dashPattern(dash, w));
  };
  const line = (p: Pt, q: Pt) => {
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.stroke();
  };
  const poly = (list: Pt[], close = true) => {
    ctx.beginPath();
    list.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    if (close) ctx.closePath();
  };
  const fill = (color = fillColor, alpha = fillAlpha) => {
    if (d.fill === "none") return;
    ctx.fillStyle = withAlpha(color, alpha);
    ctx.fill();
  };
  const change = () => {
    if (!d.showLabel || !b) return;
    const text = changeLabel(p1, p2, s.step, s.formatPrice);
    tag(ctx, text, b.x + 8, b.y + (b.y < a.y ? -14 : 14), withAlpha(d.color, 0.92));
  };

  switch (d.type) {
    case "trendline":
    case "arrow":
      if (!b) break;
      stroke();
      line(...extendLine(a, b, width, d.extendLeft, d.extendRight));
      if (d.type === "arrow") {
        ctx.setLineDash([]);
        arrowHead(ctx, a, b, 8 + lw * 2);
      }
      change();
      break;
    case "ray":
      if (!b) break;
      stroke();
      line(a, rayEnd(a, b, width));
      change();
      break;
    case "extended":
      if (!b) break;
      stroke();
      line(...extendLine(a, b, width, true, true));
      change();
      break;
    case "hline":
    case "hray":
      stroke();
      line({ x: d.type === "hray" ? a.x : 0, y: a.y }, { x: width, y: a.y });
      if (d.showLabel !== false)
        tag(ctx, s.formatPrice(p1.price), width - 4, a.y, d.color, "right");
      break;
    case "vline":
      stroke();
      line({ x: a.x, y: 0 }, { x: a.x, y: height });
      tag(ctx, timeLabel(p1.time), a.x, height - 14, d.color, "center");
      break;
    case "crossline":
      stroke();
      line({ x: 0, y: a.y }, { x: width, y: a.y });
      line({ x: a.x, y: 0 }, { x: a.x, y: height });
      tag(ctx, s.formatPrice(p1.price), width - 4, a.y, d.color, "right");
      tag(ctx, timeLabel(p1.time), a.x, height - 14, d.color, "center");
      break;
    case "channel": {
      if (!b) break;
      const dy = c ? channelOffset(d.points) : 0;
      const a2 = s.toScreen({ time: p1.time, price: p1.price + dy });
      const b2 = s.toScreen({ time: p2.time, price: p2.price + dy });
      if (!a2 || !b2) break;
      const [s1, e1] = extendLine(a, b, width, d.extendLeft, d.extendRight);
      const [s2, e2] = extendLine(a2, b2, width, d.extendLeft, d.extendRight);
      poly([s1, e1, e2, s2]);
      fill();
      stroke();
      line(s1, e1);
      line(s2, e2);
      stroke("dashed", d.color, 1);
      line(
        { x: (s1.x + s2.x) / 2, y: (s1.y + s2.y) / 2 },
        { x: (e1.x + e2.x) / 2, y: (e1.y + e2.y) / 2 },
      );
      break;
    }
    case "fib":
    case "fibext": {
      const ext = d.type === "fibext";
      if (!b || (ext && !c)) {
        if (b) {
          stroke("dashed");
          line(a, b);
        }
        break;
      }
      const priceOf = (lv: number) => (ext ? fibExtPrice(p1, p2, p3, lv) : fibPrice(p1, p2, lv));
      const startX = ext ? c!.x : Math.min(a.x, b.x);
      const span = ext ? Math.max(60, Math.abs(b.x - a.x)) : Math.abs(b.x - a.x);
      const x1 = d.extendLeft ? 0 : startX;
      const x2 = d.extendRight ? width : startX + span;
      const levels = fibLevels(d)
        .filter((l) => l.visible)
        .map((l) => ({ ...l, y: s.toScreen({ time: p1.time, price: priceOf(l.value) })?.y }))
        .filter((l): l is typeof l & { y: number } => l.y != null)
        .sort((m, n) => m.value - n.value);
      levels.forEach((l, i) => {
        const prev = levels[i - 1];
        if (!prev || d.fill === "none") return;
        ctx.fillStyle = withAlpha(l.color ?? fillColor, fillAlpha);
        ctx.fillRect(x1, Math.min(l.y, prev.y), x2 - x1, Math.abs(l.y - prev.y));
      });
      for (const l of levels) {
        stroke(d.dash, l.color ?? d.color, Math.max(1, lw - 1));
        line({ x: x1, y: l.y }, { x: x2, y: l.y });
        if (d.showLabel !== false) {
          ctx.setLineDash([]);
          ctx.font = font(11);
          ctx.fillStyle = l.color ?? d.color;
          ctx.textBaseline = "bottom";
          ctx.fillText(`${l.value} (${s.formatPrice(priceOf(l.value))})`, x1 + 4, l.y - 2);
        }
      }
      stroke("dashed", d.color, 1);
      poly(ext ? [a, b, c!] : [a, b], false);
      ctx.stroke();
      break;
    }
    case "fibtime": {
      if (!b) break;
      const zones = fibLevels(d)
        .filter((l) => l.visible)
        .sort((l, m) => l.value - m.value);
      const xs = s.timeZoneXs(
        p1,
        p2,
        zones.map((z) => z.value),
      );
      const shown = zones
        .map((z, i) => ({ ...z, x: xs[i] }))
        .filter((z): z is FibLevel & { x: number } => z.x != null);
      // Bands between neighbouring zones, in the left zone's colour.
      if (d.fill !== "none")
        shown.forEach((z, i) => {
          const next = shown[i + 1];
          if (!next) return;
          ctx.fillStyle = withAlpha(z.color ?? fillColor, (d.fillOpacity ?? 0.12) * 0.4);
          ctx.fillRect(Math.min(z.x, next.x), 0, Math.abs(next.x - z.x), height);
        });
      // Labels skip a zone that sits too close to the last one drawn (0, 1, 2, 3 bunch up).
      let lastLabel = -Infinity;
      for (const z of shown) {
        const color = z.color ?? d.color;
        stroke(d.dash, color, Math.max(1, lw - 1));
        line({ x: z.x, y: 0 }, { x: z.x, y: height });
        if (d.showLabel === false) continue;
        const text = String(z.value);
        ctx.font = font(11);
        if (Math.abs(z.x - lastLabel) < ctx.measureText(text).width + PAD * 2 + 4) continue;
        lastLabel = z.x;
        // Along the foot of the pane (the legend owns the top); dark text reads on every zone colour.
        tag(ctx, text, z.x + 2, height - 14, color, "left", "#0a0a0b");
      }
      break;
    }
    case "rect": {
      if (!b) break;
      ctx.beginPath();
      ctx.roundRect(
        Math.min(a.x, b.x),
        Math.min(a.y, b.y),
        Math.abs(b.x - a.x),
        Math.abs(b.y - a.y),
        2,
      );
      fill();
      stroke();
      ctx.stroke();
      break;
    }
    case "ellipse": {
      if (!b) break;
      ctx.beginPath();
      ctx.ellipse(
        (a.x + b.x) / 2,
        (a.y + b.y) / 2,
        Math.abs(b.x - a.x) / 2,
        Math.abs(b.y - a.y) / 2,
        0,
        0,
        Math.PI * 2,
      );
      fill();
      stroke();
      ctx.stroke();
      break;
    }
    case "triangle":
      poly(P, P.length > 2);
      if (P.length > 2) fill();
      stroke();
      ctx.stroke();
      break;
    case "path":
      stroke();
      poly(P, false);
      ctx.stroke();
      break;
    case "brush": {
      stroke("solid");
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      // Quadratic smoothing through midpoints keeps freehand strokes soft.
      for (let i = 1; i < P.length - 1; i++) {
        ctx.quadraticCurveTo(
          P[i]!.x,
          P[i]!.y,
          (P[i]!.x + P[i + 1]!.x) / 2,
          (P[i]!.y + P[i + 1]!.y) / 2,
        );
      }
      const last = P[P.length - 1]!;
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
      break;
    }
    case "text":
    case "callout": {
      const at = d.type === "callout" ? (b ?? a) : a;
      if (d.type === "callout" && b) {
        stroke("solid", d.color, 1.5);
        line(a, b);
        ctx.beginPath();
        ctx.arc(a.x, a.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = d.color;
        ctx.fill();
      }
      const fontSize = d.fontSize ?? 13;
      const text = d.text || (d.type === "callout" ? "Callout" : "Note");
      const lines = text.split("\n");
      const box = textBox(text, fontSize);
      const top = at.y - box.h;
      ctx.setLineDash([]);
      if (d.fill !== "none") {
        ctx.fillStyle = d.color;
        ctx.beginPath();
        ctx.roundRect(at.x, top, box.w, box.h, 6);
        ctx.fill();
      }
      ctx.font = font(fontSize);
      ctx.fillStyle = d.fill === "none" ? d.color : "#fff";
      ctx.textBaseline = "top";
      lines.forEach((ln, i) =>
        ctx.fillText(ln, at.x + PAD, top + PAD / 2 + i * Math.round(fontSize * 1.35)),
      );
      break;
    }
    case "pricelabel": {
      ctx.setLineDash([]);
      const text = s.formatPrice(p1.price);
      ctx.font = font(11, 600);
      const w = ctx.measureText(text).width + PAD * 2;
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.x + 8, a.y - 10);
      ctx.lineTo(a.x + 8 + w, a.y - 10);
      ctx.lineTo(a.x + 8 + w, a.y + 10);
      ctx.lineTo(a.x + 8, a.y + 10);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textBaseline = "middle";
      ctx.fillText(text, a.x + 8 + PAD, a.y + 0.5);
      break;
    }
    case "markup":
    case "markdown": {
      // The tip touches the anchor; the body points away from it.
      const dir = d.type === "markup" ? 1 : -1;
      const { x, y } = a;
      ctx.setLineDash([]);
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 8, y + dir * 9);
      ctx.lineTo(x + 3.5, y + dir * 9);
      ctx.lineTo(x + 3.5, y + dir * 20);
      ctx.lineTo(x - 3.5, y + dir * 20);
      ctx.lineTo(x - 3.5, y + dir * 9);
      ctx.lineTo(x - 8, y + dir * 9);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "pricerange":
    case "daterange":
    case "measure": {
      if (!b) break;
      const tone = d.type === "measure" ? (p2.price >= p1.price ? s.up : s.down) : d.color;
      ctx.beginPath();
      ctx.rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      fill(d.type === "measure" ? tone : fillColor);
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      stroke("solid", tone, 1.5);
      if (d.type !== "daterange") {
        line({ x: midX, y: a.y }, { x: midX, y: b.y });
        arrowHead(ctx, { x: midX, y: a.y }, { x: midX, y: b.y }, 7);
      }
      if (d.type !== "pricerange") {
        line({ x: a.x, y: midY }, { x: b.x, y: midY });
        arrowHead(ctx, { x: a.x, y: midY }, { x: b.x, y: midY }, 7);
      }
      const diff = p2.price - p1.price;
      const sign = diff >= 0 ? "+" : "−";
      const pct = p1.price ? Math.abs((diff / p1.price) * 100) : 0;
      const priceText = `${sign}${s.formatPrice(Math.abs(diff))} (${sign}${pct.toFixed(2)}%)`;
      const timeText = `${Math.round((p2.time - p1.time) / s.step)} bars · ${formatDuration(p2.time - p1.time)}`;
      const text =
        d.type === "pricerange"
          ? priceText
          : d.type === "daterange"
            ? timeText
            : `${priceText} · ${timeText}`;
      tag(ctx, text, midX, Math.max(a.y, b.y) + 16, withAlpha(tone, 0.95), "center");
      break;
    }
    case "long":
    case "short": {
      if (!b || !c) break;
      const x1 = Math.min(a.x, b.x);
      const w = Math.max(24, Math.abs(b.x - a.x));
      const mid = x1 + w / 2;
      ctx.setLineDash([]);
      ctx.fillStyle = withAlpha(s.up, 0.18);
      ctx.fillRect(x1, Math.min(a.y, b.y), w, Math.abs(b.y - a.y));
      ctx.fillStyle = withAlpha(s.down, 0.18);
      ctx.fillRect(x1, Math.min(a.y, c.y), w, Math.abs(c.y - a.y));
      stroke("solid", s.text, 1.5);
      line({ x: x1, y: a.y }, { x: x1 + w, y: a.y });
      const st = positionStats(d.points);
      const off = (q: Pt) => (q.y < a.y ? -12 : 12);
      tag(
        ctx,
        `Target ${s.formatPrice(p2.price)} (${st.targetPct.toFixed(2)}%)`,
        mid,
        b.y + off(b),
        withAlpha(s.up, 0.95),
        "center",
      );
      tag(
        ctx,
        `Stop ${s.formatPrice(p3.price)} (${st.stopPct.toFixed(2)}%)`,
        mid,
        c.y + off(c),
        withAlpha(s.down, 0.95),
        "center",
      );
      const rr = Number.isFinite(st.ratio) ? st.ratio.toFixed(2) : "∞";
      tag(
        ctx,
        `${d.type === "long" ? "Long" : "Short"} · R:R ${rr}`,
        mid,
        a.y,
        "rgba(51, 65, 85, 0.95)",
        "center",
      );
      break;
    }
  }

  if (!selected) return;
  ctx.setLineDash([]);
  if (d.type === "brush") {
    // Brushes show a soft glow instead of hundreds of handles.
    ctx.save();
    ctx.globalAlpha = 0.25;
    stroke("solid", d.color, lw + 6);
    poly(P, false);
    ctx.stroke();
    ctx.restore();
    return;
  }
  for (const p of P) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = d.locked ? d.color : s.background;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = d.color;
    ctx.stroke();
  }
}

/** Renders every drawing of the current coin on top of the price pane. */
export class DrawingsPrimitive implements ISeriesPrimitive<Time> {
  private requestUpdate?: () => void;
  private readonly view: IPrimitivePaneView;

  constructor(private readonly getState: () => DrawingsState) {
    const renderer: IPrimitivePaneRenderer = {
      draw: (target: Target) =>
        target.useMediaCoordinateSpace(({ context, mediaSize }) => {
          const s = this.getState();
          if (!s.hidden) {
            for (const d of s.drawings) drawOne(context, mediaSize, d, s, d.id === s.selectedId);
          }
          if (s.preview) drawOne(context, mediaSize, s.preview, s, true);
        }),
    };
    this.view = { zOrder: () => "top", renderer: () => renderer };
  }

  attached({ requestUpdate }: SeriesAttachedParameter<Time>) {
    this.requestUpdate = requestUpdate;
  }

  detached() {
    this.requestUpdate = undefined;
  }

  /** Redraw after drawings, selection or the preview changed. */
  update() {
    this.requestUpdate?.();
  }

  updateAllViews() {}

  paneViews() {
    return [this.view];
  }
}
