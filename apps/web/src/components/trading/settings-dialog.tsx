"use client";

import { X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SettingsTab = { id: string; label: string; content: React.ReactNode };

type Props = {
  open: boolean;
  title: string;
  tabs: SettingsTab[];
  /** Changes apply live; Cancel restores the state from when the dialog opened. */
  onCancel: () => void;
  onDefaults: () => void;
  onClose: () => void;
};

/** TradingView-style settings dialog: tabs, live preview, Defaults / Cancel / OK. */
export function SettingsDialog({ open, title, tabs, onCancel, onDefaults, onClose }: Props) {
  const [tab, setTab] = useState(tabs[0]?.id);
  const active = tabs.find((t) => t.id === tab) ?? tabs[0];

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="animate-fade-in fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          aria-describedby={undefined}
          className="border-border bg-bg animate-pop-in fixed left-1/2 top-1/2 z-50 flex max-h-[85dvh] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border shadow-2xl"
        >
          <div className="border-border flex items-center justify-between border-b px-5 py-3">
            <Dialog.Title className="font-semibold">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="text-muted hover:text-text hover:bg-surface-2 rounded-md p-1"
              >
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>

          {tabs.length > 1 && (
            <div
              role="tablist"
              aria-label="Settings sections"
              className="border-border flex gap-4 border-b px-5"
            >
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={t.id === active?.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "text-muted hover:text-text -mb-px border-b-2 border-transparent py-2.5 text-sm font-medium",
                    t.id === active?.id && "border-brand text-text",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          <div role="tabpanel" className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
            {active?.content}
          </div>

          <div className="border-border flex items-center gap-2 border-t px-5 py-3">
            <Button variant="ghost" size="sm" onClick={onDefaults}>
              Defaults
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => {
                onCancel();
                onClose();
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={onClose}>
              OK
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** One labelled settings row. */
export function Row({
  label,
  children,
  htmlFor,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-3">
      <label htmlFor={htmlFor} className="text-muted min-w-0 flex-1 text-sm">
        {label}
      </label>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

export const inputCls =
  "border-border bg-surface h-8 rounded-md border px-2 text-sm tabular-nums outline-none focus-visible:border-ring";

export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-brand size-4"
      />
      {label}
    </label>
  );
}
