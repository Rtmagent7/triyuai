import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SECTORS, sectorById, type SectorId } from "@triyuai/shared/sectors";
import { PercentBadge } from "@/components/coin/percent-badge";
import { Money } from "@/components/coin/money";
import { MarketTable } from "@/components/market/market-table";
import { SectorNav } from "@/components/market/sector-tags";
import { serverApi } from "@/lib/api/server";
import { statsFor } from "@/lib/market/sectors";

export const revalidate = 60;
export const dynamicParams = false;
export const generateStaticParams = () => SECTORS.map((s) => ({ id: s.id }));

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const sector = sectorById((await params).id);
  if (!sector) return {};
  return {
    title: `${sector.label} coins by market cap`,
    description: `${sector.blurb} Prices, market cap and 24h moves of every ${sector.label} coin in the top 250.`,
  };
}

export default async function CategoryPage({ params }: Props) {
  const sector = sectorById((await params).id);
  if (!sector) notFound();
  const { data } = await serverApi.coins(1, 250);
  const s = statsFor(sector, data.coins);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{sector.label}</h1>
          <p className="text-muted mt-1 max-w-xl text-sm">{sector.blurb}</p>
        </div>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
          <Stat label="Coins">{s.coins.length}</Stat>
          <Stat label="Market cap">
            <Money value={s.marketCap} />
          </Stat>
          <Stat label="24h">
            <PercentBadge value={s.change24h} />
          </Stat>
          <Stat label="7d">
            <PercentBadge value={s.change7d} />
          </Stat>
        </dl>
      </div>
      <SectorNav current={sector.id as SectorId} />
      <MarketTable coins={s.coins} />
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted text-xs">{label}</dt>
      <dd className="tabular font-semibold">{children}</dd>
    </div>
  );
}
