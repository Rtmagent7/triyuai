"use client";

import { Copy, Lock, LockOpen, Settings2, Trash2 } from "lucide-react";
import { hasFill, hasLine, hasText, toolLabel, type Drawing } from "@/lib/ta/drawings";
import { cn } from "@/lib/utils";
import { ColorPicker } from "./color-picker";
import { LineStylePicker } from "./line-style-picker";

type Props = {
  drawing: Drawing;
  onChange: (d: Drawing) => void;
  onSettings: () => void;
  onClone: () => void;
  onDelete: () => void;
};

const btn =
  "text-muted hover:bg-surface-2 hover:text-text flex size-8 items-center justify-center rounded-md [&_svg]:size-4";

/** Quick style controls floating over the chart for the selected drawing (TradingView-style). */
export function SelectionToolbar({ drawing: d, onChange, onSettings, onClone, onDelete }: Props) {
  const set = (patch: Partial<Drawing>) => onChange({ ...d, ...patch });
  return (
    <div
      role="toolbar"
      aria-label={`${toolLabel(d.type)} options`}
      className="border-border bg-bg/95 absolute left-1/2 top-10 z-20 flex -translate-x-1/2 items-center gap-1 rounded-lg border p-1 shadow-lg backdrop-blur"
      // Keep chart pointer handlers from treating toolbar clicks as chart clicks.
      onPointerDown={(e) => e.stopPropagation()}
    >
      {d.type !== "long" && d.type !== "short" && (
        <ColorPicker
          label={hasText(d.type) ? "Text background" : hasLine(d.type) ? "Line colour" : "Colour"}
          value={d.color}
          onChange={(color) => set({ color })}
        />
      )}
      {hasLine(d.type) && (
        <LineStylePicker
          label="Line style"
          width={d.width ?? 2}
          dash={d.dash ?? "solid"}
          onChange={(patch) => set(patch)}
        />
      )}
      {hasFill(d.type) && (
        <ColorPicker
          label="Background"
          value={d.fill && d.fill !== "none" ? d.fill : d.color}
          onChange={(fill) => set({ fill })}
          opacity={d.fillOpacity ?? 0.12}
          onOpacity={(fillOpacity) => set({ fillOpacity })}
        />
      )}
      {hasText(d.type) && (
        <select
          aria-label="Font size"
          value={d.fontSize ?? 13}
          onChange={(e) => set({ fontSize: Number(e.target.value) })}
          className="border-border bg-surface h-8 rounded-md border px-1 text-xs"
        >
          {[10, 11, 12, 13, 14, 16, 18, 20, 24, 28].map((s) => (
            <option key={s} value={s}>
              {s}px
            </option>
          ))}
        </select>
      )}
      <span aria-hidden className="bg-border mx-0.5 h-5 w-px" />
      <button type="button" className={btn} onClick={onSettings} title="Settings">
        <Settings2 />
        <span className="sr-only">Drawing settings</span>
      </button>
      <button
        type="button"
        className={cn(btn, d.locked && "text-brand hover:text-brand")}
        aria-pressed={!!d.locked}
        onClick={() => set({ locked: !d.locked })}
        title={d.locked ? "Unlock" : "Lock in place"}
      >
        {d.locked ? <Lock /> : <LockOpen />}
        <span className="sr-only">Lock</span>
      </button>
      <button type="button" className={btn} onClick={onClone} title="Clone">
        <Copy />
        <span className="sr-only">Clone drawing</span>
      </button>
      <button type="button" className={btn} onClick={onDelete} title="Delete (Del)">
        <Trash2 />
        <span className="sr-only">Delete drawing</span>
      </button>
    </div>
  );
}
