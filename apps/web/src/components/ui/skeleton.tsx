import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      // Light sweep across the placeholder (calmer than a pulse).
      className={cn(
        "animate-shimmer rounded-md bg-[linear-gradient(90deg,var(--surface-2)_25%,var(--border)_50%,var(--surface-2)_75%)] bg-[length:200%_100%]",
        className,
      )}
      {...props}
    />
  );
}
