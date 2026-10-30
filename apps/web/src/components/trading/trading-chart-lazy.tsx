"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/** Lightweight Charts + the TA toolkit load after first paint (client only). */
export const TradingChartLazy = dynamic(
  () => import("./trading-chart").then((m) => m.TradingChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

/**
 * Same box as the compact chart (45 px toolbar + 360/420 px plot + borders), so the
 * content below does not move when the chart arrives (CLS).
 */
export function ChartSkeleton() {
  return (
    <div className="border-border flex h-full flex-col overflow-hidden rounded-2xl border">
      <div className="border-border flex h-[45px] shrink-0 items-center border-b px-2">
        <Skeleton className="h-6 w-56" />
      </div>
      <div className="h-[360px] p-2 sm:h-[420px]">
        <Skeleton className="h-full rounded-xl" />
      </div>
    </div>
  );
}
