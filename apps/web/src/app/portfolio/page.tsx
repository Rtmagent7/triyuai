import type { Metadata } from "next";
import { PortfolioView } from "@/components/portfolio/portfolio-view";

export const metadata: Metadata = {
  title: "Portfolio tracker",
  description:
    "Record crypto buys and sells and see positions, average cost and profit or loss at live prices.",
};

export default function PortfolioPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
        <p className="text-muted mt-1 text-sm">
          What you hold, what it cost and how it&apos;s doing, from the buys and sells you record.
        </p>
      </div>
      <PortfolioView />
    </div>
  );
}
