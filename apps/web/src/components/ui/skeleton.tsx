import { cn } from "@/lib/utils";

/** A flat bar at the size of the value it stands in for; a slow pulse says it is loading. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn("bg-surface-2 animate-pulse rounded-md", className)}
      {...props}
    />
  );
}
