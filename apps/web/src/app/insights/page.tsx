import type { Metadata } from "next";
import Link from "next/link";
import { FearGreedCard } from "@/components/insights/fear-greed-card";
import {
  AltcoinsVsBitcoinCard,
  DominanceCard,
  SectorTable,
} from "@/components/insights/market-structure";
import { serverApi } from "@/lib/api/server";
import { sectorStats } from "@/lib/market/sectors";

export const revalidate = 60;
export const metadata: Metadata = {
  title: "Market insights: Fear & Greed, BTC and USDT dominance, sectors",
  description:
    "The Crypto Fear & Greed Index, Bitcoin, USDT and stablecoin dominance, altcoins against Bitcoin, and how each sector is moving.",
};

export default async function InsightsPage() {
  const [{ data: global }, { data: page }] = await Promise.all([
    serverApi.global(),
    serverApi.coins(1, 250),
  ]);
  const stats = sectorStats(page.coins);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
        <p className="text-muted mt-1 text-sm">
          Sentiment, where the money sits, and which sectors it is moving into.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <FearGreedCard />
        <DominanceCard global={global} coins={page.coins} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <AltcoinsVsBitcoinCard coins={page.coins} />
        <section aria-labelledby="sectors-heading" className="min-w-0 space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 id="sectors-heading" className="font-semibold">
              Sectors
            </h2>
            <Link href="/categories" className="text-muted hover:text-text text-xs">
              All {stats.length} sectors
            </Link>
          </div>
          <SectorTable stats={stats} limit={8} />
        </section>
      </div>
    </div>
  );
}
