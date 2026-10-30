"use client";

import { Popover } from "radix-ui";
import type { LineDash } from "@/lib/ta/colors";
import { cn } from "@/lib/utils";

const WIDTHS = [1, 2, 3, 4];
const DASHES: { value: LineDash; label: string; css: string }[] = [
  { value: "solid", label: "Solid", css: "solid" },
  { value: "dashed", label: "Dashed", css: "dashed" },
  { value: "dotted", label: "Dotted", css: "dotted" },
];

type Props = {
  label: string;
  width: number;
  dash: LineDash;
  onChange: (patch: { width?: number; dash?: LineDash }) => void;
  className?: string;
};

const sample = (width: number, dash: LineDash) => ({
  borderTopWidth: width,
  borderTopStyle: DASHES.find((d) => d.value === dash)!.css as "solid",
});

/** Width (1–4 px) and dash pattern, previewed as real lines. */
export function LineStylePicker({ label, width, dash, onChange, className }: Props) {
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={`${label}: ${width}px ${dash}`}
        title={label}
        className={cn(
          "border-border hover:border-muted flex h-8 w-12 shrink-0 items-center justify-center rounded-md border px-2",
          className,
        )}
      >
        <span className="border-text w-full" style={sample(width, dash)} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          collisionPadding={8}
          className="border-border bg-bg animate-pop-in z-[60] w-44 space-y-2 rounded-xl border p-2 text-sm shadow-xl"
        >
          <div role="radiogroup" aria-label="Line width">
            {WIDTHS.map((w) => (
              <button
                key={w}
                type="button"
                role="radio"
                aria-checked={w === width}
                aria-label={`${w}px`}
                onClick={() => onChange({ width: w })}
                className={cn(
                  "hover:bg-surface-2 flex h-8 w-full items-center gap-3 rounded-md px-2",
                  w === width && "bg-surface-2",
                )}
              >
                <span className="border-text flex-1" style={sample(w, "solid")} />
                <span className="text-muted w-8 text-right text-xs">{w}px</span>
              </button>
            ))}
          </div>
          <div role="radiogroup" aria-label="Line style" className="border-border border-t pt-2">
            {DASHES.map((d) => (
              <button
                key={d.value}
                type="button"
                role="radio"
                aria-checked={d.value === dash}
                aria-label={d.label}
                onClick={() => onChange({ dash: d.value })}
                className={cn(
                  "hover:bg-surface-2 flex h-8 w-full items-center gap-3 rounded-md px-2",
                  d.value === dash && "bg-surface-2",
                )}
              >
                <span className="border-text flex-1" style={sample(2, d.value)} />
                <span className="text-muted w-12 text-right text-xs">{d.label}</span>
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
