import type { Metadata } from "next";
import { ExchangesSummary, ExchangesTable } from "@/components/market/exchanges-table";
import { serverApi } from "@/lib/api/server";

export const revalidate = 600;
export const metadata: Metadata = {
  title: "Crypto exchanges ranked by Trust Score",
  description:
    "The top 100 crypto exchanges by CoinGecko Trust Score, with 24h trading volume, share of volume, country and founding year.",
};

export default async function ExchangesPage() {
  const { data } = await serverApi.exchanges();
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Exchanges</h1>
          <p className="text-muted mt-1 max-w-2xl text-sm">
            The 100 exchanges CoinGecko rates highest. Trust Score (1–10) weighs liquidity, scale,
            API coverage and security; volume is reported in BTC and shown here at today&apos;s
            Bitcoin price.
          </p>
        </div>
        <ExchangesSummary exchanges={data} />
      </div>
      <ExchangesTable exchanges={data} />
    </div>
  );
}
