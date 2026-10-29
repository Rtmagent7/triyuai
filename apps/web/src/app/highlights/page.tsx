import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, Flame, TrendingDown, TrendingUp } from "lucide-react";
import type { CoinSummary } from "@triyuai/shared";
import { CoinLogo } from "@/components/coin/coin-logo";
import { PercentBadge } from "@/components/coin/percent-badge";
import { Card } from "@/components/ui/card";
import { Money, Price } from "@/components/coin/money";
import { serverApi } from "@/lib/api/server";

export const revalidate = 60;
export const metadata: Metadata = {
  title: "Crypto highlights: trending, top gainers & losers",
  description:
    "Trending coins, the biggest 24h gainers and losers in the top 250, and the highest-volume coins.",
};

export default async function HighlightsPage() {
  const { data: h } = await serverApi.highlights();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Highlights</h1>
        <p className="text-muted mt-1 text-sm">
          What&apos;s trending and moving most within the top 250 coins.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <List
          title="Trending"
          icon={<Flame className="size-4 text-orange-500" />}
          coins={h.trending}
        />
        <List
          title="Highest volume (24h)"
          icon={<BarChart3 className="text-brand size-4" />}
          coins={h.highestVolume}
          volume
        />
        <List
          title="Top gainers (24h)"
          icon={<TrendingUp className="text-up size-4" />}
          coins={h.gainers}
        />
        <List
          title="Top losers (24h)"
          icon={<TrendingDown className="text-down size-4" />}
          coins={h.losers}
        />
      </div>
    </div>
  );
}

function List({
  title,
  icon,
  coins,
  volume,
}: {
  title: string;
  icon: React.ReactNode;
  coins: (CoinSummary & { volume24h?: number })[];
  volume?: boolean;
}) {
  return (
    <Card className="min-w-0 p-4">
      <h2 className="mb-2 flex items-center gap-2 px-2 font-semibold">
        {icon}
        {title}
      </h2>
      <ol>
        {coins.map((c, i) => (
          <li key={c.id}>
            <Link
              href={`/coins/${c.id}`}
              // Lists show many coins; prefetching each would render every page (and call the API) up front.
              prefetch={false}
              className="hover:bg-surface-2 flex items-center gap-3 rounded-lg px-2 py-2 text-sm"
            >
              <span className="text-muted tabular w-4 text-xs">{i + 1}</span>
              <CoinLogo src={c.image} name={c.name} size={24} />
              <span className="min-w-0 truncate font-medium">{c.name}</span>
              <span className="text-muted text-xs">{c.symbol}</span>
              <span className="tabular ml-auto text-right">
                {volume && c.volume24h != null ? (
                  <Money value={c.volume24h} />
                ) : (
                  <Price value={c.price} />
                )}
              </span>
              <PercentBadge value={c.change24h} className="w-16 justify-end text-xs" />
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}
