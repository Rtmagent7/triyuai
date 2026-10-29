"use client";

import {
  Eraser,
  Magnet,
  Minus,
  MousePointer2,
  MoveUpRight,
  Rows4,
  Slash,
  Square,
  Trash2,
  Type,
} from "lucide-react";
import { toolLabel, type DrawingTool } from "@/lib/ta/drawings";
import { cn } from "@/lib/utils";
import { useChartLayout } from "@/stores/chart-layout";

export const DRAWING_COLORS = ["#2962ff", "#f59e0b", "#22c55e", "#ef4444", "#a855f7", "#64748b"];

const tools: [DrawingTool, typeof Slash, string][] = [
  ["cursor", MousePointer2, "Esc"],
  ["trendline", Slash, "Alt+T"],
  ["ray", MoveUpRight, ""],
  ["hline", Minus, "Alt+H"],
  ["fib", Rows4, "Alt+F"],
  ["rect", Square, ""],
  ["text", Type, ""],
];

const btn =
  "text-muted hover:bg-surface-2 hover:text-text flex size-9 items-center justify-center rounded-md transition-colors [&_svg]:size-[18px]";

type Props = {
  tool: DrawingTool;
  onTool: (t: DrawingTool) => void;
  color: string;
  onColor: (c: string) => void;
  hasSelection: boolean;
  onDeleteSelected: () => void;
  onClear: () => void;
  count: number;
};

/** TradingView-style vertical tool strip (horizontal on phones). */
export function DrawingToolbar(p: Props) {
  const magnet = useChartLayout((s) => s.magnet);
  const toggleMagnet = useChartLayout((s) => s.toggleMagnet);

  return (
    <div
      role="toolbar"
      aria-label="Drawing tools"
      aria-orientation="vertical"
      className="border-border flex shrink-0 gap-0.5 overflow-x-auto border-b p-1 [scrollbar-width:none] sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r"
    >
      {tools.map(([t, Icon, key]) => (
        <button
          key={t}
          type="button"
          aria-pressed={p.tool === t}
          title={key ? `${toolLabel[t]} (${key})` : toolLabel[t]}
          onClick={() => p.onTool(t)}
          className={cn(btn, p.tool === t && "bg-brand/15 text-brand hover:text-brand")}
        >
          <Icon />
          <span className="sr-only">{toolLabel[t]}</span>
        </button>
      ))}

      <span aria-hidden className="bg-border mx-1 my-1 w-px shrink-0 sm:mx-1.5 sm:h-px sm:w-auto" />

      <button
        type="button"
        aria-pressed={magnet}
        title="Magnet: snap to open/high/low/close"
        onClick={toggleMagnet}
        className={cn(btn, magnet && "bg-brand/15 text-brand hover:text-brand")}
      >
        <Magnet />
        <span className="sr-only">Magnet</span>
      </button>

      <div
        className="flex shrink-0 items-center gap-0.5 px-1 sm:flex-col sm:py-1"
        role="radiogroup"
        aria-label="Drawing colour"
      >
        {DRAWING_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={p.color === c}
            aria-label={`Colour ${c}`}
            onClick={() => p.onColor(c)}
            // 24 px target (WCAG 2.5.8) around a 16 px swatch.
            className="flex size-6 shrink-0 items-center justify-center rounded-full"
          >
            <span
              className={cn(
                "size-4 rounded-full ring-offset-2 ring-offset-[var(--bg)]",
                p.color === c && "ring-text ring-2",
              )}
              style={{ background: c }}
            />
          </button>
        ))}
      </div>

      <button
        type="button"
        title="Delete selected drawing (Del)"
        disabled={!p.hasSelection}
        onClick={p.onDeleteSelected}
        className={cn(btn, "disabled:opacity-40")}
      >
        <Trash2 />
        <span className="sr-only">Delete selected drawing</span>
      </button>
      <button
        type="button"
        title="Remove all drawings"
        disabled={p.count === 0}
        onClick={p.onClear}
        className={cn(btn, "disabled:opacity-40")}
      >
        <Eraser />
        <span className="sr-only">Remove all drawings</span>
      </button>
    </div>
  );
}
