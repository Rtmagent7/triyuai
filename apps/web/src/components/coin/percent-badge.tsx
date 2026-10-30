import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  value: number | null | undefined;
  variant?: "text" | "pill";
  digits?: number;
  className?: string;
};

/** Green ▲ / red ▼ everywhere (PRD §14). Direction is never conveyed by colour alone. */
export function PercentBadge({ value, variant = "text", digits = 2, className }: Props) {
  if (value == null || !Number.isFinite(value))
    return <span className={cn("text-muted", className)}>—</span>;
  const up = value >= 0;
  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-0.5 whitespace-nowrap font-medium",
        up ? "text-up" : "text-down",
        // "pill" is the headline size of the same mark: colour on the figure only, no tinted box.
        variant === "pill" && "text-[1.05em] font-semibold",
        className,
      )}
    >
      <span aria-hidden className="text-[0.7em]">
        {up ? "▲" : "▼"}
      </span>
      <span className="sr-only">{up ? "up" : "down"} </span>
      {formatPercent(value, digits)}
    </span>
  );
}
