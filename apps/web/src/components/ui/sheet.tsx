"use client";

import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetTitle = Dialog.Title;
export const SheetDescription = Dialog.Description;
export const SheetClose = Dialog.Close;

type SheetContentProps = Dialog.DialogContentProps & {
  side?: "right" | "left";
  hideClose?: boolean;
};

/** Drawer on desktop, full-screen sheet below the sm breakpoint. */
export function SheetContent({
  className,
  children,
  side = "right",
  hideClose,
  ...props
}: SheetContentProps) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_150ms_ease-out]" />
      <Dialog.Content
        className={cn(
          "bg-bg sm:border-border fixed inset-y-0 z-50 flex w-full flex-col shadow-2xl outline-none sm:max-w-md",
          side === "right" ? "right-0 sm:border-l" : "left-0 sm:border-r",
          className,
        )}
        {...props}
      >
        {children}
        {!hideClose && (
          <Dialog.Close
            className="text-muted hover:bg-surface-2 hover:text-text absolute right-3 top-3 rounded-lg p-2"
            aria-label="Close"
          >
            <X className="size-4" />
          </Dialog.Close>
        )}
      </Dialog.Content>
    </Dialog.Portal>
  );
}
