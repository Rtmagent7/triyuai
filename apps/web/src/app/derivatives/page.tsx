import type { Metadata } from "next";
import { DerivativesView } from "@/components/derivatives/derivatives-view";

export const metadata: Metadata = {
  title: "Liquidation heatmap, live liquidations and funding rates",
  description:
    "Estimated liquidation levels for Bitcoin, Ethereum, Solana and other perpetuals, live Binance futures liquidations, funding rates and open interest.",
};

export default function DerivativesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Derivatives</h1>
        <p className="text-muted mt-1 text-sm">
          Leverage in the market: where it would be liquidated, what it costs to hold, and what is
          being liquidated right now. Data from Binance USDⓈ-M futures.
        </p>
      </div>
      <DerivativesView />
    </div>
  );
}
