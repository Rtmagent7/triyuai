"use client";

import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { LogicalRange, MouseEventParams, Time } from "lightweight-charts";
import { ErrorState } from "@/components/common/states";
import { Skeleton } from "@/components/ui/skeleton";
import { binanceSymbol, intervalLabel, intervalSeconds } from "@/lib/ta/binance";
import {
  TOOLS,
  channelOffset,
  drawingDefaults,
  fibExtPrice,
  fibLevels,
  fibPrice,
  hitTest,
  moveDrawing,
  pointsNeeded,
  positionPoints,
  type Anchor,
  type Drawing,
  type DrawingStyle,
  type DrawingTool,
  type DrawingType,
  type Hit,
  type HitContext,
  type Pt,
} from "@/lib/ta/drawings";
import { cn } from "@/lib/utils";
import { newDrawingId, useChartLayout } from "@/stores/chart-layout";
import { ChartEngine, pricePrecision, type ChartColors } from "./chart-engine";
import { ChartLegend } from "./chart-legend";
import { ChartToolbar } from "./chart-toolbar";
import { DrawingSettings } from "./drawing-settings";
import { ToolIcon } from "./drawing-icons";
import { DrawingToolbar } from "./drawing-toolbar";
import { textBox } from "./drawings-primitive";
import { SelectionToolbar } from "./selection-toolbar";
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

/** A new drawing with the current style; per-type defaults (e.g. marker colours) win. */
const makeDrawing = (
  type: DrawingType,
  points: Anchor[],
  st: DrawingStyle,
  text?: string,
): Drawing => ({
  id: newDrawingId(),
  type,
  points,
  color: st.color,
  width: st.width,
  dash: st.dash,
  ...drawingDefaults(type),
  ...(text != null ? { text } : {}),
});

/** Preview points while placing: positions derive their stop from entry + target. */
const previewPoints = (type: DrawingType, placed: Anchor[], cursor: Anchor) =>
  (type === "long" || type === "short") && placed[0]
    ? positionPoints(type, placed[0], cursor)
    : [...placed, cursor];

type Drag = { original: Drawing; hit: Hit; from: Anchor; current: Drawing };
type Placing = { type: DrawingType; points: Anchor[]; brushing?: boolean };
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
  const keepDrawing = useChartLayout((s) => s.keepDrawing);
  const hideDrawings = useChartLayout((s) => s.hideDrawings);
  const lockDrawings = useChartLayout((s) => s.lockDrawings);
  const indicators = useChartLayout((s) => s.indicators);
  const drawings = useChartLayout((s) => s.drawings[coinId]) ?? EMPTY;
  const drawingStyle = useChartLayout((s) => s.drawingStyle);
  const { addDrawing, updateDrawing, removeDrawing, clearDrawings } = useChartLayout.getState();
  const { resolvedTheme } = useTheme();

  const wrapper = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const engine = useRef<ChartEngine | null>(null);
  const [tool, setTool] = useState<DrawingTool>("cursor");
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const [textEdit, setTextEdit] = useState<TextEdit | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  /** Points placed so far for the current drawing (drives the hint). */
  const [placedCount, setPlacedCount] = useState(0);

  // Mutable interaction state read by the canvas renderer and pointer handlers.
  const live = useRef({
    drawings,
    selectedId,
    tool,
    drawingStyle,
    magnet,
    keepDrawing,
    hideDrawings,
    lockDrawings,
    preview: null as Drawing | null,
    placing: null as Placing | null,
    drag: null as Drag | null,
    frame: 0,
  });
  Object.assign(live.current, {
    drawings,
    selectedId,
    tool,
    drawingStyle,
    magnet,
    keepDrawing,
    hideDrawings,
    lockDrawings,
  });

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
        hidden: s.hideDrawings,
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
  }, [drawings, selectedId, hideDrawings]);

  /* ---------- drawing interaction (full chart only) ---------- */

  /** Extra screen geometry hit testing needs for some drawing types. */
  const hitContext = useCallback((d: Drawing, width: number): HitContext => {
    const e = engine.current!;
    const ctx: HitContext = { width };
    const [p1, p2, p3] = d.points as [Anchor, Anchor, Anchor];
    if (d.type === "text" || d.type === "callout") {
      ctx.textBox = textBox(d.text || (d.type === "callout" ? "Callout" : "Note"), d.fontSize);
    } else if (d.type === "pricelabel") {
      const w = textBox(fmtRef.current(p1.price), 11).w;
      ctx.textBox = { w: w + 8, h: 20 };
    } else if (d.type === "channel" && p3) {
      const dy = channelOffset(d.points);
      const a2 = e.toScreen({ time: p1.time, price: p1.price + dy });
      const b2 = e.toScreen({ time: p2.time, price: p2.price + dy });
      if (a2 && b2) ctx.parallel = [a2, b2];
    } else if ((d.type === "fib" && p2) || (d.type === "fibext" && p3)) {
      ctx.levelYs = fibLevels(d)
        .filter((l) => l.visible)
        .map((l) =>
          e.toScreen({
            time: p1.time,
            price: d.type === "fib" ? fibPrice(p1, p2, l.value) : fibExtPrice(p1, p2, p3, l.value),
          }),
        )
        .flatMap((q) => (q ? [q.y] : []));
    } else if (d.type === "fibtime" && p2) {
      const values = fibLevels(d)
        .filter((l) => l.visible)
        .map((l) => l.value);
      ctx.levelXs = e.timeZoneXs(p1, p2, values).flatMap((x) => (x == null ? [] : [x]));
    }
    return ctx;
  }, []);

  const findHit = useCallback(
    (p: Pt) => {
      const e = engine.current;
      if (!e || live.current.hideDrawings) return null;
      const { width } = e.mainPane();
      const list = live.current.drawings;
      for (let i = list.length - 1; i >= 0; i--) {
        const d = list[i]!;
        const pts = d.points.map((a) => e.toScreen(a));
        if (pts.some((x) => !x)) continue;
        // Labels are drawn above (text) or centred on (price label) their anchor.
        const probe =
          d.type === "pricelabel"
            ? { x: p.x, y: p.y - 10 }
            : d.type === "text" || d.type === "callout"
              ? { x: p.x, y: p.y + 2 }
              : p;
        const handleHit = hitTest(d, pts as Pt[], p, hitContext(d, width));
        const hit =
          handleHit?.part === "handle"
            ? handleHit
            : hitTest(d, pts as Pt[], probe, hitContext(d, width));
        if (hit) return { d, hit };
      }
      return null;
    },
    [hitContext],
  );

  const cancelPlacing = useCallback(() => {
    const s = live.current;
    s.placing = null;
    s.preview = null;
    setPlacedCount(0);
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

  /** Saves a finished drawing; text-like tools then ask for their text. */
  const finish = useCallback(
    (type: DrawingType, points: Anchor[], at?: Pt) => {
      const s = live.current;
      s.placing = null;
      s.preview = null;
      setPlacedCount(0);
      const pts =
        (type === "long" || type === "short") && points.length >= 2
          ? positionPoints(type, points[0]!, points[1]!)
          : points;
      const d = makeDrawing(type, pts, s.drawingStyle);
      addDrawing(coinId, d);
      setSelectedId(d.id);
      if (type === "callout" && at)
        setTextEdit({ x: at.x, y: at.y, anchor: pts[1]!, id: d.id, value: "" });
      if (!s.keepDrawing) setTool("cursor");
      engine.current?.redrawDrawings();
    },
    [coinId, addDrawing],
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
    const finishMulti = () => {
      const pl = s.placing;
      if (!pl) return;
      // A double-click adds the same point twice; drop near-duplicates.
      const pts = pl.points.filter(
        (q, i) =>
          i === 0 || q.time !== pl.points[i - 1]!.time || q.price !== pl.points[i - 1]!.price,
      );
      if (pts.length >= 2) finish(pl.type, pts);
      else cancelPlacing();
    };

    const down = (ev: PointerEvent) => {
      const e = engine.current;
      const p = local(ev);
      if (!e || !inPane(p) || ev.button > 0) return;
      if (s.tool !== "cursor") {
        const anchor = e.toAnchor(p, s.magnet);
        if (!anchor) return;
        // Keeps focus where it is (a note input opened by this click must not blur).
        ev.preventDefault();
        ev.stopPropagation();
        const type = s.tool;
        const spec = pointsNeeded(type);
        if (spec === "free") {
          s.placing = { type, points: [anchor], brushing: true };
          s.preview = { ...makeDrawing(type, [anchor], s.drawingStyle), id: "preview" };
          el.setPointerCapture?.(ev.pointerId);
          return;
        }
        if (spec === 1) {
          if (type === "text") {
            setTextEdit({ x: p.x, y: p.y, anchor, value: "" });
            if (!s.keepDrawing) setTool("cursor");
          } else finish(type, [anchor]);
          return;
        }
        const placed = [...(s.placing?.points ?? []), anchor];
        if (typeof spec === "number" && placed.length >= spec) {
          finish(type, placed, p);
          return;
        }
        s.placing = { type, points: placed };
        s.preview = {
          ...makeDrawing(type, previewPoints(type, placed, anchor), s.drawingStyle),
          id: "preview",
        };
        setPlacedCount(placed.length);
        e.redrawDrawings();
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
      // "Lock all" behaves like every drawing being locked.
      const original = s.lockDrawings ? { ...found.d, locked: true } : found.d;
      s.drag = { original, hit: found.hit, from, current: original };
      el.setPointerCapture?.(ev.pointerId);
    };

    const move = (ev: PointerEvent) => {
      const e = engine.current;
      if (!e) return;
      const p = local(ev);
      const pl = s.placing;
      if (pl?.brushing) {
        const last = e.toScreen(pl.points[pl.points.length - 1]!);
        const a = e.toAnchor(p);
        if (a && (!last || Math.hypot(last.x - p.x, last.y - p.y) >= 3)) {
          pl.points.push(a);
          s.preview = { ...s.preview!, points: [...pl.points] };
          e.redrawDrawings();
        }
        return;
      }
      if (pl && s.preview) {
        const a = e.toAnchor(p, s.magnet);
        if (a) {
          s.preview = { ...s.preview, points: previewPoints(pl.type, pl.points, a) };
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
      const pl = s.placing;
      if (pl?.brushing) {
        if (pl.points.length >= 2) finish(pl.type, pl.points);
        else cancelPlacing();
        return;
      }
      const drag = s.drag;
      if (!drag) return;
      s.drag = null;
      engine.current?.setInteractive(true);
      if (drag.current !== drag.original && !s.lockDrawings) updateDrawing(coinId, drag.current);
    };

    const dbl = (ev: MouseEvent) => {
      if (s.placing && pointsNeeded(s.placing.type) === "multi") {
        finishMulti();
        return;
      }
      const p = local(ev);
      const found = findHit(p);
      if (found && (found.d.type === "text" || found.d.type === "callout")) {
        const at = found.d.points[found.d.type === "callout" ? 1 : 0]!;
        setTextEdit({ x: p.x, y: p.y, anchor: at, id: found.d.id, value: found.d.text ?? "" });
      }
    };

    const key = (ev: KeyboardEvent) => {
      if (ev.key === "Enter" && s.placing && pointsNeeded(s.placing.type) === "multi") {
        ev.preventDefault();
        finishMulti();
      }
    };

    el.addEventListener("pointerdown", down, true);
    el.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    el.addEventListener("dblclick", dbl);
    window.addEventListener("keydown", key);
    return () => {
      el.removeEventListener("pointerdown", down, true);
      el.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      el.removeEventListener("dblclick", dbl);
      window.removeEventListener("keydown", key);
    };
  }, [full, coinId, findHit, finish, cancelPlacing, updateDrawing]);

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

  // Keyboard: Esc cancels, Delete removes, Alt+letter picks a tool.
  useEffect(() => {
    if (!full) return;
    const shortcuts = Object.fromEntries(
      (Object.keys(TOOLS) as DrawingType[]).flatMap((t) => {
        const sc = TOOLS[t].shortcut;
        return sc ? [[sc.slice(-1).toLowerCase(), t]] : [];
      }),
    ) as Record<string, DrawingType>;
    const key = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [role=dialog], [contenteditable=true]")) return;
      if (ev.key === "Escape") {
        cancelPlacing();
        setSelectedId(null);
        setTool("cursor");
      } else if ((ev.key === "Delete" || ev.key === "Backspace") && live.current.selectedId) {
        ev.preventDefault();
        deleteSelected();
      } else if (ev.altKey) {
        const t = shortcuts[ev.key.toLowerCase()];
        if (t) {
          ev.preventDefault();
          useChartLayout.getState().setLastTool(TOOLS[t].group, t);
          chooseTool(t);
        }
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [full, cancelPlacing, deleteSelected, chooseTool]);

  const selected = drawings.find((x) => x.id === selectedId) ?? null;
  const settingsDrawing = drawings.find((x) => x.id === settingsId) ?? null;

  const cloneSelected = () => {
    if (!selected) return;
    // Offset the copy by a few bars so it is visible next to the original.
    const shift = 5 * (engine.current?.step ?? 3600);
    const copy: Drawing = {
      ...selected,
      id: newDrawingId(),
      locked: false,
      points: selected.points.map((p) => ({ ...p, time: p.time + shift })),
    };
    addDrawing(coinId, copy);
    setSelectedId(copy.id);
  };

  const saveText = () => {
    if (!textEdit) return;
    const text = textEdit.value.trim();
    if (textEdit.id) {
      const d = drawings.find((x) => x.id === textEdit.id);
      if (d) {
        // An empty new note is removed; a callout keeps its pointer with the default label.
        if (text) updateDrawing(coinId, { ...d, text });
        else if (d.type === "text") removeDrawing(coinId, d.id);
      }
    } else if (text) {
      const d = makeDrawing("text", [textEdit.anchor], drawingStyle, text);
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

  const hint = (() => {
    if (tool === "cursor") return null;
    const spec = pointsNeeded(tool);
    if (spec === "free") return "Drag on the chart to draw";
    if (spec === "multi")
      return placedCount
        ? "Click to add points · double-click or Enter to finish"
        : "Click to start the path";
    if (spec === 1) return "Click to place";
    return `Point ${placedCount + 1} of ${spec}`;
  })();

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
      {/* Full: fills the fixed-height frame. Compact: fixed plot height (flex-1 would collapse it in an auto-height column). */}
      <div className={cn("flex", full && "min-h-0 flex-1 flex-col sm:flex-row")}>
        {full && (
          <DrawingToolbar
            tool={tool}
            onTool={chooseTool}
            hasSelection={!!selectedId}
            onDeleteSelected={deleteSelected}
            onClear={clearAll}
            count={drawings.length}
          />
        )}
        <div
          className={cn(
            "relative min-w-0",
            full ? "min-h-0 flex-1" : "h-[360px] w-full sm:h-[420px]",
          )}
        >
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
          {full && selected && !textEdit && !hideDrawings && (
            <SelectionToolbar
              drawing={selected}
              onChange={(d) => updateDrawing(coinId, d)}
              onSettings={() => setSettingsId(selected.id)}
              onClone={cloneSelected}
              onDelete={deleteSelected}
            />
          )}
          {settingsDrawing && (
            <DrawingSettings
              coinId={coinId}
              drawing={settingsDrawing}
              onClose={() => setSettingsId(null)}
            />
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
              className="border-brand bg-bg animate-pop-in absolute z-20 h-8 w-56 rounded-md border px-2 text-sm shadow-lg outline-none"
              style={{ left: Math.max(4, textEdit.x), top: Math.max(4, textEdit.y - 36) }}
            />
          )}
          {hint && tool !== "cursor" && (
            <p
              key={tool}
              className="bg-bg text-text animate-fade-up border-border pointer-events-none absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border py-1 pl-1.5 pr-3 text-[13px] shadow-lg"
            >
              <span className="text-brand flex size-6 items-center justify-center [&_svg]:size-4">
                <ToolIcon tool={tool} />
              </span>
              <span className="font-medium">{TOOLS[tool].label}</span>
              <span className="text-muted">· {hint} · Esc to cancel</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
