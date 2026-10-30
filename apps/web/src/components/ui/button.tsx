import { Slot } from "radix-ui";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const variants = {
  // Ink on paper (inverted on dark); the brand blue is kept for data and selection.
  primary: "bg-primary text-primary-fg hover:opacity-85",
  secondary: "bg-surface-2 text-text hover:bg-border",
  ghost: "text-text hover:bg-surface-2",
  outline: "border border-border bg-transparent text-text hover:bg-surface-2",
  // Ask TRIYU entry points: solid logo blue with the TRIYU emblem, never a gradient.
  ai: "bg-ai text-ai-fg hover:bg-ai-hover",
} as const;

const sizes = {
  sm: "h-8 gap-1.5 rounded-lg px-3 text-[13px]",
  md: "h-9 gap-2 rounded-lg px-3.5 text-sm",
  lg: "h-11 gap-2 rounded-xl px-5 text-base",
  icon: "size-9 rounded-lg",
  "icon-sm": "size-8 rounded-lg",
} as const;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  asChild?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "secondary", size = "md", asChild, type, ...props }, ref) => {
    const Comp = asChild ? Slot.Root : "button";
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : (type ?? "button")}
        className={cn(
          "inline-flex shrink-0 items-center justify-center whitespace-nowrap font-medium transition-[color,background-color,border-color,opacity,transform] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
