"use client";

import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { LogicalRange, MouseEventParams, Time } from "lightweight-charts";
import { ErrorState } from "@/components/common/states";
import { Skeleton } from "@/components/ui/skeleton";
import { binanceSymbol, intervalLabel, intervalSeconds } from "@/lib/ta/binance";
import {
  hitTest,
  moveDrawing,
  pointsNeeded,
  type Anchor,
  type Drawing,
  type DrawingTool,
  type Hit,
  type Pt,
} from "@/lib/ta/drawings";
import { cn } from "@/lib/utils";
import { newDrawingId, useChartLayout } from "@/stores/chart-layout";
import { ChartEngine, pricePrecision, type ChartColors } from "./chart-engine";
import { ChartLegend } from "./chart-legend";
import { ChartToolbar } from "./chart-toolbar";
import { DRAWING_COLORS, DrawingToolbar } from "./drawing-toolbar";
import { textBox } from "./drawings-primitive";
import { useKlines } from "./use-klines";

type Props = {
  coinId: string;
  /** Coin ticker, e.g. "BTC"; the chart uses its USDT pair on Binance. */
  ticker: string;
  variant: "full" | "compact";
  /** Rendered instead when the coin has no Binance USDT pair. */
  fallback?: React.ReactNode;
  className?: string;
};

const EMPTY: Drawing[] = [];

const css = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const readColors = (): ChartColors => ({
  text: css("--text"),
  muted: css("--muted"),
  border: css("--border"),
  background: css("--bg"),
  brand: css("--brand"),
  up: css("--up"),
  down: css("--down"),
});

type Drag = { original: Drawing; hit: Hit; from: Anchor; current: Drawing };
type TextEdit = { x: number; y: number; anchor: Anchor; id?: string; value: string };

/**
 * Technical-analysis chart on Binance candles: timeframes, chart styles, indicators
 * in their own panes, drawing tools and a layout saved in the browser.
 */
export function TradingChart({ coinId, ticker, variant, fallback, className }: Props) {
  const full = variant === "full";
  const symbol = binanceSymbol(ticker);
  const pair = `${ticker.toUpperCase()}/USDT`;
  const interval = useChartLayout((s) => s.interval);
  const style = useChartLayout((s) => s.style);
  const scale = useChartLayout((s) => s.scale);
  const magnet = useChartLayout((s) => s.magnet);
  const indicators = useChartLayout((s) => s.indicators);
  const drawings = useChartLayout((s) => s.drawings[coinId]) ?? EMPTY;
  const { addDrawing, updateDrawing, removeDrawing, clearDrawings } = useChartLayout.getState();
  const { resolvedTheme } = useTheme();

  const wrapper = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const engine = useRef<ChartEngine | null>(null);
  const [tool, setTool] = useState<DrawingTool>("cursor");
  const [color, setColor] = useState(DRAWING_COLORS[0]!);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const [textEdit, setTextEdit] = useState<TextEdit | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  /** A two-point drawing has its first point (drives the hint text). */
  const [placing, setPlacing] = useState(false);

  // Mutable interaction state read by the canvas renderer and pointer handlers.
  const live = useRef({
    drawings,
    selectedId,
    tool,
    color,
    magnet,
    preview: null as Drawing | null,
    placing: null as Anchor | null,
    drag: null as Drag | null,
    frame: 0,
  });
  Object.assign(live.current, { drawings, selectedId, tool, color, magnet });

  const lastClose = engine.current?.bars.at(-1)?.close ?? 1;
  const precision = pricePrecision(lastClose);
  const formatPrice = useCallback(
    (p: number) =>
      p.toLocaleString("en-US", {
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
      }),
    [precision],
  );
  const fmtRef = useRef(formatPrice);
  fmtRef.current = formatPrice;

  /** Re-render the legend at most once per frame for live ticks. */
  const bump = useCallback(() => {
    if (live.current.frame) return;
    live.current.frame = requestAnimationFrame(() => {
      live.current.frame = 0;
      setTick((n) => n + 1);
    });
  }, []);

  const klines = useKlines(symbol, interval, {
    onReset: (bars) => {
      engine.current?.setBars(bars, intervalSeconds[interval], { reset: true });
      setHoverIndex(null);
      bump();
    },
    onLive: () => {
      engine.current?.updateLast();
      bump();
    },
    onPrepend: (bars, added) => {
      engine.current?.setBars(bars, intervalSeconds[interval], { shift: added });
      bump();
    },
  });
  const loadMore = useRef(klines.loadMore);
  loadMore.current = klines.loadMore;

  /* ---------- chart lifecycle ---------- */

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const e = new ChartEngine(el, readColors(), () => {
      const s = live.current;
      const list = s.drag
        ? s.drawings.map((d) => (d.id === s.drag!.current.id ? s.drag!.current : d))
        : s.drawings;
      return {
        drawings: list,
        preview: s.preview,
        selectedId: s.selectedId,
        formatPrice: (p) => fmtRef.current(p),
        text: css("--text"),
      };
    });
    engine.current = e;

    const onMove = (param: MouseEventParams<Time>) =>
      setHoverIndex(param.point && param.logical != null ? e.indexAt(param.logical) : null);
    const onRange = (range: LogicalRange | null) => {
      if (range && range.from < 30) void loadMore.current();
    };
    e.chart.subscribeCrosshairMove(onMove);
    e.chart.timeScale().subscribeVisibleLogicalRangeChange(onRange);
    const state = live.current;
    return () => {
      cancelAnimationFrame(state.frame);
      e.destroy();
      engine.current = null;
    };
  }, [full]);

  // Theme and style recreate the price series; indicators only rebuild their panes.
  const indicatorsRef = useRef(indicators);
  indicatorsRef.current = indicators;
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    e.applyTheme(readColors());
    e.setStyle(style);
    e.setIndicators(indicatorsRef.current);
    bump();
  }, [resolvedTheme, style, bump]);

  useEffect(() => {
    engine.current?.setIndicators(indicators);
    bump();
  }, [indicators, bump]);

  useEffect(() => engine.current?.setScale(scale), [scale]);

  useEffect(() => {
    engine.current?.redrawDrawings();
  }, [drawings, selectedId]);

  /* ---------- drawing interaction (full chart only) ---------- */

  const findHit = useCallback((p: Pt) => {
    const e = engine.current;
    if (!e) return null;
    const { width } = e.mainPane();
    const list = live.current.drawings;
    for (let i = list.length - 1; i >= 0; i--) {
      const d = list[i]!;
      const pts = d.points.map((a) => e.toScreen(a));
      if (pts.some((x) => !x)) continue;
      const box = d.type === "text" ? textBox(d.text || "Note") : undefined;
      // Text labels are drawn above their anchor.
      const probe = d.type === "text" ? { x: p.x, y: p.y + 2 } : p;
      const hit = hitTest(d, pts as Pt[], probe, width, box);
      if (hit) return { d, hit };
    }
    return null;
  }, []);

  const cancelPlacing = useCallback(() => {
    const s = live.current;
    s.placing = null;
    s.preview = null;
    setPlacing(false);
    engine.current?.redrawDrawings();
  }, []);

  const chooseTool = useCallback(
    (t: DrawingTool) => {
      cancelPlacing();
      setTool(t);
      if (t !== "cursor") setSelectedId(null);
    },
    [cancelPlacing],
  );

  // Panning would fight with placing points.
  useEffect(() => engine.current?.setInteractive(tool === "cursor"), [tool]);

  useEffect(() => {
    const el = container.current;
    if (!full || !el) return;
    const s = live.current;
    const local = (ev: PointerEvent | MouseEvent): Pt => {
      const r = el.getBoundingClientRect();
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
    };
    const inPane = (p: Pt) => {
      const pane = engine.current?.mainPane();
      return !!pane && p.x >= 0 && p.y >= 0 && p.x <= pane.width && p.y <= pane.height;
    };

    const down = (ev: PointerEvent) => {
      const e = engine.current;
      const p = local(ev);
      if (!e || !inPane(p) || ev.button > 0) return;
      if (s.tool !== "cursor") {
        const anchor = e.toAnchor(p, s.magnet);
        if (!anchor) return;
        // Keeps focus where it is (the note input opened by this click must not blur).
        ev.preventDefault();
        ev.stopPropagation();
        const type = s.tool;
        if (pointsNeeded[type] === 1) {
          if (type === "text") setTextEdit({ x: p.x, y: p.y, anchor, value: "" });
          else {
            const d: Drawing = { id: newDrawingId(), type, points: [anchor], color: s.color };
            addDrawing(coinId, d);
            setSelectedId(d.id);
          }
          setTool("cursor");
          return;
        }
        if (!s.placing) {
          s.placing = anchor;
          s.preview = { id: "preview", type, points: [anchor, anchor], color: s.color };
          setPlacing(true);
          e.redrawDrawings();
        } else {
          const d: Drawing = {
            id: newDrawingId(),
            type,
            points: [s.placing, anchor],
            color: s.color,
          };
          s.placing = null;
          s.preview = null;
          setPlacing(false);
          addDrawing(coinId, d);
          setSelectedId(d.id);
          setTool("cursor");
        }
        return;
      }
      const found = findHit(p);
      if (!found) {
        if (s.selectedId) setSelectedId(null);
        return;
      }
      const from = e.toAnchor(p);
      if (!from) return;
      ev.stopPropagation();
      e.setInteractive(false);
      setSelectedId(found.d.id);
      setColor(found.d.color);
      s.drag = { original: found.d, hit: found.hit, from, current: found.d };
      el.setPointerCapture?.(ev.pointerId);
    };

    const move = (ev: PointerEvent) => {
      const e = engine.current;
      if (!e) return;
      const p = local(ev);
      if (s.placing && s.preview) {
        const a = e.toAnchor(p, s.magnet);
        if (a) {
          s.preview = { ...s.preview, points: [s.placing, a] };
          e.redrawDrawings();
        }
        return;
      }
      if (s.drag) {
        const a = e.toAnchor(p, s.magnet && s.drag.hit.part === "handle");
        if (a) {
          s.drag.current = moveDrawing(s.drag.original, s.drag.hit, s.drag.from, a);
          e.redrawDrawings();
        }
        return;
      }
      el.style.cursor =
        s.tool !== "cursor" ? "crosshair" : inPane(p) && findHit(p) ? "pointer" : "";
    };

    const up = () => {
      const drag = s.drag;
      if (!drag) return;
      s.drag = null;
      engine.current?.setInteractive(true);
      if (drag.current !== drag.original) updateDrawing(coinId, drag.current);
    };

    const dbl = (ev: MouseEvent) => {
      const p = local(ev);
      const found = findHit(p);
      if (found?.d.type === "text") {
        setTextEdit({
          x: p.x,
          y: p.y,
          anchor: found.d.points[0]!,
          id: found.d.id,
          value: found.d.text ?? "",
        });
      }
    };

    el.addEventListener("pointerdown", down, true);
    el.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    el.addEventListener("dblclick", dbl);
    return () => {
      el.removeEventListener("pointerdown", down, true);
      el.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      el.removeEventListener("dblclick", dbl);
    };
  }, [full, coinId, findHit, addDrawing, updateDrawing]);

  const deleteSelected = useCallback(() => {
    const id = live.current.selectedId;
    if (!id) return;
    removeDrawing(coinId, id);
    setSelectedId(null);
  }, [coinId, removeDrawing]);

  const clearAll = useCallback(() => {
    const previous = live.current.drawings;
    clearDrawings(coinId);
    setSelectedId(null);
    toast("Drawings removed", {
      action: {
        label: "Undo",
        onClick: () => previous.forEach((d) => addDrawing(coinId, d)),
      },
    });
  }, [coinId, clearDrawings, addDrawing]);

  // Keyboard: Esc cancels, Delete removes, Alt+T/H/F pick tools.
  useEffect(() => {
    if (!full) return;
    const key = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable=true]")) return;
      if (ev.key === "Escape") {
        cancelPlacing();
        setSelectedId(null);
        setTool("cursor");
      } else if ((ev.key === "Delete" || ev.key === "Backspace") && live.current.selectedId) {
        ev.preventDefault();
        deleteSelected();
      } else if (ev.altKey) {
        const map: Record<string, DrawingTool> = { t: "trendline", h: "hline", f: "fib" };
        const t = map[ev.key.toLowerCase()];
        if (t) {
          ev.preventDefault();
          chooseTool(t);
        }
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [full, cancelPlacing, deleteSelected, chooseTool]);

  const pickColor = (c: string) => {
    setColor(c);
    const d = drawings.find((x) => x.id === selectedId);
    if (d) updateDrawing(coinId, { ...d, color: c });
  };

  const saveText = () => {
    if (!textEdit) return;
    const text = textEdit.value.trim();
    if (textEdit.id) {
      const d = drawings.find((x) => x.id === textEdit.id);
      if (d) {
        if (text) updateDrawing(coinId, { ...d, text });
        else removeDrawing(coinId, d.id);
      }
    } else if (text) {
      const d: Drawing = {
        id: newDrawingId(),
        type: "text",
        points: [textEdit.anchor],
        color,
        text,
      };
      addDrawing(coinId, d);
      setSelectedId(d.id);
    }
    setTextEdit(null);
  };

  /* ---------- toolbar actions ---------- */

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === wrapper.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrapper.current?.requestFullscreen?.();
  };

  const screenshot = () => {
    const canvas = engine.current?.screenshot();
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `TRIYUAI_${symbol}_${interval}.png`;
    a.click();
  };

  const status = klines.status;
  const title = `${pair} · ${intervalLabel[interval]} · Binance`;
  const bars = engine.current?.bars ?? [];
  const computed = engine.current?.computed ?? new Map();

  if (status === "unavailable" && fallback) return <>{fallback}</>;

  return (
    <div
      ref={wrapper}
      className={cn(
        "border-border bg-bg flex flex-col overflow-hidden rounded-2xl border",
        fullscreen && "rounded-none border-0",
        className,
      )}
    >
      <ChartToolbar
        variant={variant}
        coinId={coinId}
        pair={pair}
        fullscreen={fullscreen}
        onFullscreen={toggleFullscreen}
        onScreenshot={screenshot}
      />
      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
        {full && (
          <DrawingToolbar
            tool={tool}
            onTool={chooseTool}
            color={color}
            onColor={pickColor}
            hasSelection={!!selectedId}
            onDeleteSelected={deleteSelected}
            onClear={clearAll}
            count={drawings.length}
          />
        )}
        <div className={cn("relative min-h-0 flex-1", !full && "h-[360px] sm:h-[420px]")}>
          <div
            ref={container}
            data-testid="trading-chart"
            className={cn("absolute inset-0 touch-none", status !== "ready" && "invisible")}
            aria-label={`${pair} price chart`}
            role="img"
          />
          {status === "ready" && (
            <ChartLegend
              title={title}
              bars={bars}
              index={hoverIndex}
              computed={computed}
              formatPrice={formatPrice}
              editable={full}
            />
          )}
          {status === "loading" && <Skeleton className="absolute inset-2 rounded-xl" />}
          {status === "error" && (
            <ErrorState
              message="Candles could not be loaded from Binance."
              onRetry={klines.retry}
              className="absolute inset-0"
            />
          )}
          {status === "unavailable" && (
            <p className="text-muted absolute inset-0 flex items-center justify-center p-6 text-center text-sm">
              {pair} is not traded on Binance, so candles aren&apos;t available for this coin.
            </p>
          )}
          {textEdit && (
            <input
              autoFocus
              aria-label="Note text"
              value={textEdit.value}
              placeholder="Type a note, Enter to save"
              maxLength={80}
              onChange={(ev) => setTextEdit({ ...textEdit, value: ev.target.value })}
              onKeyDown={(ev) => {
                if (ev.key === "Enter") saveText();
                if (ev.key === "Escape") setTextEdit(null);
              }}
              onBlur={saveText}
              className="border-brand bg-bg absolute z-20 h-8 w-56 rounded-md border px-2 text-sm shadow-lg outline-none"
              style={{ left: Math.max(4, textEdit.x), top: Math.max(4, textEdit.y - 36) }}
            />
          )}
          {tool !== "cursor" && (
            <p className="bg-surface/90 text-muted pointer-events-none absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full px-3 py-1 text-xs">
              {pointsNeeded[tool as Exclude<DrawingTool, "cursor">] === 2
                ? placing
                  ? "Click to set the second point · Esc to cancel"
                  : "Click to set the first point"
                : "Click to place · Esc to cancel"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
