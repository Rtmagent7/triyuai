"use client";

import { Popover } from "radix-ui";
import { useState } from "react";
import {
  GROUPS,
  TOOLS,
  toolLabel,
  toolsIn,
  type DrawingTool,
  type DrawingType,
  type ToolGroup,
} from "@/lib/ta/drawings";
import { cn } from "@/lib/utils";
import { useChartLayout } from "@/stores/chart-layout";
import { ColorPicker } from "./color-picker";
import {
  EyeIcon,
  KeepDrawingIcon,
  LockIcon,
  MagnetIcon,
  SparkCleanIcon,
  ToolIcon,
  TrashIcon,
} from "./drawing-icons";
import { LineStylePicker } from "./line-style-picker";

const btn =
  "text-muted hover:bg-surface-2 hover:text-text relative flex size-9 shrink-0 items-center justify-center rounded-lg transition-[color,background-color,transform] duration-150 active:scale-90";
const on = "bg-brand/15 text-brand hover:bg-brand/20 hover:text-brand";

type Props = {
  tool: DrawingTool;
  onTool: (t: DrawingTool) => void;
  hasSelection: boolean;
  onDeleteSelected: () => void;
  onClear: () => void;
  count: number;
};

/** Drawing rail: cursor, five tool groups (each opens a card panel), style and utilities. */
export function DrawingToolbar(p: Props) {
  const s = useChartLayout();

  return (
    <div
      role="toolbar"
      aria-label="Drawing tools"
      aria-orientation="vertical"
      className="border-border relative flex shrink-0 items-center gap-0.5 overflow-x-auto border-b p-1 [scrollbar-width:none] sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r"
    >
      <button
        type="button"
        aria-pressed={p.tool === "cursor"}
        title="Cursor (Esc)"
        onClick={() => p.onTool("cursor")}
        className={cn(btn, p.tool === "cursor" && on)}
      >
        <ToolIcon tool="cursor" />
        <span className="sr-only">Cursor</span>
      </button>

      {GROUPS.map((g) => (
        <GroupButton
          key={g.id}
          group={g.id}
          label={g.label}
          tool={p.tool}
          last={s.lastTools[g.id]}
          onPick={(t) => {
            s.setLastTool(g.id, t);
            p.onTool(t);
          }}
        />
      ))}

      <Sep />

      <ColorPicker
        label="New drawing colour"
        value={s.drawingStyle.color}
        onChange={(color) => s.setDrawingStyle({ color })}
        className="size-9 border-transparent"
      />
      <LineStylePicker
        label="New drawing line"
        width={s.drawingStyle.width}
        dash={s.drawingStyle.dash}
        onChange={s.setDrawingStyle}
        className="h-9 w-9 border-transparent px-1.5"
      />

      <Sep />

      <Toggle
        label="Magnet: snap to open/high/low/close"
        name="Magnet"
        pressed={s.magnet}
        onClick={s.toggleMagnet}
      >
        <MagnetIcon />
      </Toggle>
      <Toggle
        label="Keep drawing: stay in the tool after each drawing"
        name="Keep drawing"
        pressed={s.keepDrawing}
        onClick={() => s.toggle("keepDrawing")}
      >
        <KeepDrawingIcon />
      </Toggle>
      <Toggle
        label={s.lockDrawings ? "Unlock all drawings" : "Lock all drawings"}
        name="Lock all drawings"
        pressed={s.lockDrawings}
        onClick={() => s.toggle("lockDrawings")}
      >
        <LockIcon open={!s.lockDrawings} />
      </Toggle>
      <Toggle
        label={s.hideDrawings ? "Show drawings" : "Hide all drawings"}
        name="Hide all drawings"
        pressed={s.hideDrawings}
        onClick={() => s.toggle("hideDrawings")}
      >
        <EyeIcon off={s.hideDrawings} />
      </Toggle>

      <Sep />

      <button
        type="button"
        title="Delete selected drawing (Del)"
        disabled={!p.hasSelection}
        onClick={p.onDeleteSelected}
        className={cn(btn, "disabled:opacity-35 disabled:active:scale-100")}
      >
        <TrashIcon />
        <span className="sr-only">Delete selected drawing</span>
      </button>
      <button
        type="button"
        title="Remove all drawings"
        disabled={p.count === 0}
        onClick={p.onClear}
        className={cn(btn, "disabled:opacity-35 disabled:active:scale-100")}
      >
        <SparkCleanIcon />
        <span className="sr-only">Remove all drawings</span>
      </button>
    </div>
  );
}

function GroupButton({
  group,
  label,
  tool,
  last,
  onPick,
}: {
  group: ToolGroup;
  label: string;
  tool: DrawingTool;
  last: DrawingType;
  onPick: (t: DrawingType) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = tool !== "cursor" && TOOLS[tool].group === group;
  const shown = active ? (tool as DrawingType) : last;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={`${label} tools`}
        title={`${label}: ${toolLabel(shown)}`}
        className={cn(btn, active && on, open && !active && "bg-surface-2 text-text")}
      >
        <ToolIcon tool={shown} />
        {/* Corner notch: this button opens a panel of tools. */}
        <span
          aria-hidden
          className="absolute bottom-1 right-1 size-1 rounded-full bg-current opacity-50"
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="right"
          align="start"
          sideOffset={8}
          collisionPadding={8}
          aria-label={`${label} tools`}
          className="border-border bg-bg/95 animate-pop-in z-50 w-[22rem] max-w-[calc(100vw-1rem)] rounded-2xl border p-2 shadow-2xl backdrop-blur"
        >
          <p className="text-muted px-2 pb-2 pt-1 text-xs font-medium uppercase tracking-wide">
            {label}
          </p>
          <div role="menu" aria-label={`${label} tools`} className="grid grid-cols-2 gap-1">
            {toolsIn(group).map((t) => (
              <button
                key={t}
                type="button"
                role="menuitemradio"
                aria-checked={tool === t}
                onClick={() => {
                  onPick(t);
                  setOpen(false);
                }}
                className={cn(
                  "hover:bg-surface-2 group flex min-h-14 items-start gap-2.5 rounded-xl p-2 text-left transition-colors",
                  tool === t && "bg-brand/10",
                )}
              >
                <span
                  className={cn(
                    "bg-surface-2 text-text group-hover:bg-bg flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                    tool === t && "bg-brand/15 text-brand",
                  )}
                >
                  <ToolIcon tool={t} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium leading-tight">
                    {TOOLS[t].label}
                  </span>
                  <span className="text-muted mt-0.5 block text-[11px] leading-snug">
                    {TOOLS[t].hint}
                    {TOOLS[t].shortcut && (
                      <kbd className="border-border ml-1 rounded border px-1 font-sans text-[10px]">
                        {TOOLS[t].shortcut}
                      </kbd>
                    )}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Toggle({
  label,
  name,
  pressed,
  onClick,
  children,
}: {
  label: string;
  name: string;
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
      className={cn(btn, pressed && on)}
    >
      {children}
      <span className="sr-only">{name}</span>
    </button>
  );
}

function Sep() {
  return (
    <span aria-hidden className="bg-border mx-1 my-1 h-6 w-px shrink-0 sm:mx-1.5 sm:h-px sm:w-6" />
  );
}
