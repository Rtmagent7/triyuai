"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/** Lightweight Charts is ~60 kB; load it after first paint to keep the page under the JS budget. */
export const PriceChartLazy = dynamic(() => import("./price-chart").then((m) => m.PriceChart), {
  ssr: false,
  loading: () => (
    <div className="border-border rounded-2xl border p-4 sm:p-5">
      <Skeleton className="h-11 w-40" />
      <Skeleton className="mt-4 h-[300px] rounded-xl sm:h-[380px]" />
    </div>
  ),
});
