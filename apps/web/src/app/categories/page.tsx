import type { Metadata } from "next";
import { SectorTable } from "@/components/insights/market-structure";
import { SectorNav } from "@/components/market/sector-tags";
import { serverApi } from "@/lib/api/server";
import { sectorStats } from "@/lib/market/sectors";

export const revalidate = 60;
export const metadata: Metadata = {
  title: "Crypto sectors: Layer 1, DeFi, meme, RWA, AI and more",
  description:
    "The top 250 coins grouped by sector, with each sector's market cap, volume and market-cap-weighted 24h and 7d moves.",
};

export default async function CategoriesPage() {
  const { data } = await serverApi.coins(1, 250);
  const stats = sectorStats(data.coins);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sectors</h1>
        <p className="text-muted mt-1 max-w-2xl text-sm">
          The top 250 coins grouped by what they are, using CoinGecko&apos;s categories. A coin can
          sit in more than one sector (NEAR is a Layer 1 and an AI coin), so sector totals overlap.
          Moves are weighted by market cap.
        </p>
      </div>
      <SectorNav />
      <SectorTable stats={stats} />
    </div>
  );
}
