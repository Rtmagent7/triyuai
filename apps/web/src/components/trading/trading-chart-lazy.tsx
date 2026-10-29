"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Lightweight Charts + the TA toolkit load after first paint (client only). */
export const TradingChartLazy = dynamic(
  () => import("./trading-chart").then((m) => m.TradingChart),
  {
    ssr: false,
    loading: () => <ChartSkeleton />,
  },
);

export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("border-border rounded-2xl border p-3", className)}>
      <Skeleton className="h-7 w-64" />
      <Skeleton className="mt-3 h-[360px] rounded-xl sm:h-[420px]" />
    </div>
  );
}
