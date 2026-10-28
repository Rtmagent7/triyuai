import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("border-border bg-surface rounded-2xl border", className)} {...props} />
  );
}
