import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";
import {
  FIB_LEVELS,
  fibPrice,
  rayEnd,
  type Anchor,
  type Drawing,
  type Pt,
} from "@/lib/ta/drawings";

type Target = Parameters<IPrimitivePaneRenderer["draw"]>[0];

export type DrawingsState = {
  drawings: Drawing[];
  /** The drawing being placed (follows the pointer). */
  preview: Drawing | null;
  selectedId: string | null;
  toScreen: (a: Anchor) => Pt | null;
  formatPrice: (p: number) => string;
  text: string;
  background: string;
};

export const TEXT_FONT = "500 12px Inter, ui-sans-serif, system-ui, sans-serif";
const PAD = 6;

let measureCtx: CanvasRenderingContext2D | null = null;
/** Size of a text note's label box, shared by the renderer and hit testing. */
export function textBox(text: string) {
  measureCtx ??= document.createElement("canvas").getContext("2d");
  if (!measureCtx) return { w: text.length * 7 + PAD * 2, h: 22 };
  measureCtx.font = TEXT_FONT;
  return { w: measureCtx.measureText(text).width + PAD * 2, h: 22 };
}

export function withAlpha(color: string, a: number) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return color;
  const n = parseInt(color.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fg: string,
  bg: string,
) {
  ctx.font = TEXT_FONT;
  const w = ctx.measureText(text).width + PAD * 2;
  ctx.fillStyle = bg;
  ctx.fillRect(x, y - 9, w, 18);
  ctx.fillStyle = fg;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + PAD, y);
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
  ctx.strokeStyle = d.color;
  ctx.lineWidth = selected ? 2.5 : 2;
  ctx.setLineDash([]);

  const line = (p: Pt, q: Pt) => {
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.stroke();
  };

  switch (d.type) {
    case "trendline":
      if (b) line(a, b);
      break;
    case "ray":
      if (b) line(a, rayEnd(a, b, width));
      break;
    case "hline":
      line({ x: 0, y: a.y }, { x: width, y: a.y });
      label(ctx, s.formatPrice(d.points[0]!.price), width - 90, a.y, "#fff", d.color);
      break;
    case "rect":
      if (!b) break;
      ctx.fillStyle = withAlpha(d.color, 0.12);
      ctx.fillRect(
        Math.min(a.x, b.x),
        Math.min(a.y, b.y),
        Math.abs(b.x - a.x),
        Math.abs(b.y - a.y),
      );
      ctx.strokeRect(
        Math.min(a.x, b.x),
        Math.min(a.y, b.y),
        Math.abs(b.x - a.x),
        Math.abs(b.y - a.y),
      );
      break;
    case "fib": {
      if (!b) break;
      const [p1, p2] = d.points as [Anchor, Anchor];
      const x1 = Math.min(a.x, b.x);
      const x2 = Math.max(a.x, b.x);
      const ys = FIB_LEVELS.map(
        (lvl) => s.toScreen({ time: p1.time, price: fibPrice(p1, p2, lvl) })?.y ?? 0,
      );
      ys.forEach((y, i) => {
        if (i > 0) {
          ctx.fillStyle = withAlpha(d.color, 0.04 + (i % 2) * 0.05);
          ctx.fillRect(x1, Math.min(y, ys[i - 1]!), x2 - x1, Math.abs(y - ys[i - 1]!));
        }
      });
      ctx.lineWidth = 1;
      FIB_LEVELS.forEach((lvl, i) => {
        line({ x: x1, y: ys[i]! }, { x: x2, y: ys[i]! });
        ctx.font = TEXT_FONT;
        ctx.fillStyle = d.color;
        ctx.textBaseline = "bottom";
        ctx.fillText(`${lvl} (${s.formatPrice(fibPrice(p1, p2, lvl))})`, x1 + 4, ys[i]! - 2);
      });
      ctx.setLineDash([4, 4]);
      line(a, b);
      ctx.setLineDash([]);
      break;
    }
    case "text":
      label(ctx, d.text || "Note", a.x, a.y - 11, "#fff", d.color);
      break;
  }

  if (selected) {
    for (const p of pts as Pt[]) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = s.background;
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
