import type { Metadata } from "next";
import { Suspense } from "react";
import { CompareView } from "@/components/compare/compare-view";
import { MAX_COINS } from "@/lib/compare";

export const metadata: Metadata = {
  title: "Compare cryptocurrencies side by side",
  description:
    "Compare up to four coins: price performance on one chart, market cap, volume, supply and distance from all-time high.",
};

export default function ComparePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Compare</h1>
        <p className="text-muted mt-1 text-sm">
          Up to {MAX_COINS} coins on one chart, each as a % change from the start of the range, with
          their market data side by side. The highest value in each row is in bold.
        </p>
      </div>
      {/* The coins live in ?coins=, read on the client so adding or removing one is instant. */}
      <Suspense>
        <CompareView />
      </Suspense>
    </div>
  );
}
