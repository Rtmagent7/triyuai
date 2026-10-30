"use client";

import { Check } from "lucide-react";
import { Popover } from "radix-ui";
import { useEffect, useState } from "react";
import { PALETTE, normalizeHex } from "@/lib/ta/colors";
import { cn } from "@/lib/utils";
import { useChartLayout } from "@/stores/chart-layout";

type Props = {
  /** Accessible name, e.g. "Line colour". */
  label: string;
  value: string;
  onChange: (color: string) => void;
  /** Shows an opacity slider (0–1) for fills. */
  opacity?: number;
  onOpacity?: (opacity: number) => void;
  className?: string;
};

/** Swatch button that opens a TradingView-style palette with custom and recent colours. */
export function ColorPicker({ label, value, onChange, opacity, onOpacity, className }: Props) {
  const recent = useChartLayout((s) => s.recentColors);
  const addRecent = useChartLayout((s) => s.addRecentColor);
  const [hex, setHex] = useState(value);
  useEffect(() => setHex(value), [value]);

  const pickCustom = (c: string) => {
    onChange(c);
    addRecent(c);
  };

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={`${label}: ${value}`}
        title={label}
        className={cn(
          "border-border hover:border-muted flex size-8 shrink-0 items-center justify-center rounded-md border",
          className,
        )}
      >
        <span
          className="size-5 rounded-sm border border-black/10"
          style={{ background: value, opacity: opacity ?? 1 }}
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          collisionPadding={8}
          className="border-border bg-bg z-[60] w-[272px] space-y-3 rounded-xl border p-3 text-sm shadow-xl"
        >
          <div role="radiogroup" aria-label={label} className="grid grid-cols-10 gap-0.5">
            {PALETTE.flat().map((c) => (
              <Swatch key={c} color={c} selected={c === value.toLowerCase()} onPick={onChange} />
            ))}
          </div>

          {recent.length > 0 && (
            <div>
              <p className="text-muted mb-1 text-xs">Recent</p>
              <div className="grid grid-cols-10 gap-0.5">
                {recent.map((c) => (
                  <Swatch
                    key={c}
                    color={c}
                    selected={c === value.toLowerCase()}
                    onPick={onChange}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <label className="border-border relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-md border">
              <span className="sr-only">Custom colour</span>
              <input
                type="color"
                value={normalizeHex(value) ?? "#2962ff"}
                onChange={(e) => pickCustom(e.target.value)}
                className="absolute -inset-2 size-12 cursor-pointer"
              />
            </label>
            <input
              aria-label="Hex colour"
              value={hex}
              onChange={(e) => {
                setHex(e.target.value);
                const n = normalizeHex(e.target.value);
                if (n) onChange(n);
              }}
              onBlur={() => {
                const n = normalizeHex(hex);
                if (n) addRecent(n);
                else setHex(value);
              }}
              className="border-border bg-surface h-8 min-w-0 flex-1 rounded-md border px-2 font-mono text-xs uppercase"
              spellCheck={false}
            />
          </div>

          {onOpacity && opacity != null && (
            <label className="flex items-center gap-3">
              <span className="text-muted w-14 text-xs">Opacity</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(opacity * 100)}
                onChange={(e) => onOpacity(Number(e.target.value) / 100)}
                className="accent-brand flex-1"
              />
              <span className="tabular w-9 text-right text-xs">{Math.round(opacity * 100)}%</span>
            </label>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Swatch({
  color,
  selected,
  onPick,
}: {
  color: string;
  selected: boolean;
  onPick: (c: string) => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={color}
      onClick={() => onPick(color)}
      className="flex size-6 items-center justify-center rounded-sm"
    >
      <span
        className={cn(
          "flex size-5 items-center justify-center rounded-sm border border-black/10",
          selected && "ring-text ring-2 ring-offset-1 ring-offset-[var(--bg)]",
        )}
        style={{ background: color }}
      >
        {selected && <Check className="size-3 text-white mix-blend-difference" />}
      </span>
    </button>
  );
}
