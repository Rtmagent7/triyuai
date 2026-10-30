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
  extendLine,
  fibLevels,
  fibPrice,
  rayEnd,
  type Anchor,
  type Drawing,
  type Pt,
} from "@/lib/ta/drawings";

export { withAlpha };

type Target = Parameters<IPrimitivePaneRenderer["draw"]>[0];

export type DrawingsState = {
  drawings: Drawing[];
  /** The drawing being placed (follows the pointer). */
  preview: Drawing | null;
  selectedId: string | null;
  toScreen: (a: Anchor) => Pt | null;
  formatPrice: (p: number) => string;
  /** Bar interval in seconds (for "N bars" labels). */
  step: number;
  text: string;
  background: string;
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

/** Small filled tag with text, vertically centred on y. */
function tag(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  bg: string,
  fg = "#fff",
) {
  ctx.setLineDash([]);
  ctx.font = font(11);
  const w = ctx.measureText(text).width + PAD * 2;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(x, y - 9, w, 18, 4);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + PAD, y);
  return w;
}

function drawOne(
  ctx: CanvasRenderingContext2D,
  width: number,
  d: Drawing,
  s: DrawingsState,
  selected: boolean,
) {
  const pts = d.points.map(s.toScreen);
  if (pts.some((p) => !p)) return;
  const [a, b] = pts as Pt[];
  if (!a) return;
  const lw = d.width ?? 2;
  const stroke = (dash = d.dash) => {
    ctx.strokeStyle = d.color;
    ctx.lineWidth = lw;
    ctx.setLineDash(dashPattern(dash, lw));
  };
  const line = (p: Pt, q: Pt) => {
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.stroke();
  };
  const [p1, p2] = d.points as [Anchor, Anchor];

  switch (d.type) {
    case "trendline":
    case "ray": {
      if (!b) break;
      stroke();
      if (d.type === "ray") line(a, rayEnd(a, b, width));
      else line(...extendLine(a, b, width, d.extendLeft, d.extendRight));
      if (d.showLabel) {
        const text = changeLabel(p1, p2, s.step, s.formatPrice);
        tag(ctx, text, b.x + 8, b.y + (b.y < a.y ? -14 : 14), withAlpha(d.color, 0.9));
      }
      break;
    }
    case "hline":
      stroke();
      line({ x: 0, y: a.y }, { x: width, y: a.y });
      if (d.showLabel !== false) {
        ctx.font = font(11);
        const text = s.formatPrice(p1.price);
        tag(ctx, text, width - ctx.measureText(text).width - PAD * 2 - 4, a.y, d.color);
      }
      break;
    case "rect": {
      if (!b) break;
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      const w = Math.abs(b.x - a.x);
      const h = Math.abs(b.y - a.y);
      if (d.fill !== "none") {
        ctx.fillStyle = withAlpha(d.fill ?? d.color, d.fillOpacity ?? 0.15);
        ctx.fillRect(x, y, w, h);
      }
      stroke();
      ctx.strokeRect(x, y, w, h);
      break;
    }
    case "fib": {
      if (!b) break;
      const x1 = d.extendLeft ? 0 : Math.min(a.x, b.x);
      const x2 = d.extendRight ? width : Math.max(a.x, b.x);
      const levels = fibLevels(d)
        .filter((l) => l.visible)
        .map((l) => ({
          ...l,
          y: s.toScreen({ time: p1.time, price: fibPrice(p1, p2, l.value) })?.y,
        }))
        .filter((l): l is typeof l & { y: number } => l.y != null)
        .sort((m, n) => m.value - n.value);
      levels.forEach((l, i) => {
        const prev = levels[i - 1];
        if (!prev) return;
        ctx.fillStyle = withAlpha(l.color ?? d.fill ?? d.color, d.fillOpacity ?? 0.08);
        ctx.fillRect(x1, Math.min(l.y, prev.y), x2 - x1, Math.abs(l.y - prev.y));
      });
      for (const l of levels) {
        ctx.strokeStyle = l.color ?? d.color;
        ctx.lineWidth = Math.max(1, lw - 1);
        ctx.setLineDash(dashPattern(d.dash, ctx.lineWidth));
        line({ x: x1, y: l.y }, { x: x2, y: l.y });
        if (d.showLabel !== false) {
          ctx.setLineDash([]);
          ctx.font = font(11);
          ctx.fillStyle = l.color ?? d.color;
          ctx.textBaseline = "bottom";
          ctx.fillText(`${l.value} (${s.formatPrice(fibPrice(p1, p2, l.value))})`, x1 + 4, l.y - 2);
        }
      }
      stroke("dashed");
      line(a, b);
      break;
    }
    case "text": {
      const size = d.fontSize ?? 13;
      const lines = (d.text || "Note").split("\n");
      const box = textBox(d.text || "Note", size);
      const top = a.y - box.h;
      ctx.setLineDash([]);
      if (d.fill !== "none") {
        ctx.fillStyle = d.color;
        ctx.beginPath();
        ctx.roundRect(a.x, top, box.w, box.h, 4);
        ctx.fill();
      }
      ctx.font = font(size);
      ctx.fillStyle = d.fill === "none" ? d.color : "#fff";
      ctx.textBaseline = "top";
      lines.forEach((ln, i) =>
        ctx.fillText(ln, a.x + PAD, top + PAD / 2 + i * Math.round(size * 1.35)),
      );
      break;
    }
  }

  if (selected) {
    ctx.setLineDash([]);
    for (const p of pts as Pt[]) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = d.locked ? d.color : s.background;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = d.color;
      ctx.stroke();
    }
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
          for (const d of s.drawings)
            drawOne(context, mediaSize.width, d, s, d.id === s.selectedId);
          if (s.preview) drawOne(context, mediaSize.width, s.preview, s, true);
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
