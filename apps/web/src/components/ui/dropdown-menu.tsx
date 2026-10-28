"use client";

import { DropdownMenu as DM } from "radix-ui";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const DropdownMenu = DM.Root;
export const DropdownMenuTrigger = DM.Trigger;

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: DM.DropdownMenuContentProps) {
  return (
    <DM.Portal>
      <DM.Content
        sideOffset={sideOffset}
        className={cn(
          "border-border bg-bg z-50 min-w-36 overflow-hidden rounded-xl border p-1 text-sm shadow-xl shadow-black/10",
          className,
        )}
        {...props}
      />
    </DM.Portal>
  );
}

export function DropdownMenuLabel({ className, ...props }: DM.DropdownMenuLabelProps) {
  return <DM.Label className={cn("text-muted px-2 py-1.5 text-xs", className)} {...props} />;
}

export function DropdownMenuRadioGroup(props: DM.DropdownMenuRadioGroupProps) {
  return <DM.RadioGroup {...props} />;
}

export function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: DM.DropdownMenuRadioItemProps) {
  return (
    <DM.RadioItem
      className={cn(
        "data-[highlighted]:bg-surface-2 relative flex cursor-pointer select-none items-center gap-2 rounded-lg py-1.5 pl-2 pr-8 outline-none",
        className,
      )}
      {...props}
    >
      {children}
      <DM.ItemIndicator className="absolute right-2">
        <Check className="text-brand size-4" />
      </DM.ItemIndicator>
    </DM.RadioItem>
  );
}

export function DropdownMenuItem({ className, ...props }: DM.DropdownMenuItemProps) {
  return (
    <DM.Item
      className={cn(
        "data-[highlighted]:bg-surface-2 flex cursor-pointer select-none items-center gap-2 rounded-lg px-2 py-1.5 outline-none [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}
