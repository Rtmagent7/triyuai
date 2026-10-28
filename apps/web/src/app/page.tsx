import type { Metadata } from "next";
import { HighlightCards } from "@/components/market/highlight-cards";
import { MarketsSection } from "@/components/market/markets-section";
import { serverApi } from "@/lib/api/server";

export const revalidate = 60;

type Props = { searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const page = Number((await searchParams).page ?? 1);
  return page > 1
    ? { title: `Crypto prices — page ${page}`, alternates: { canonical: `/?page=${page}` } }
    : { alternates: { canonical: "/" } };
}

export default async function HomePage({ searchParams }: Props) {
  const raw = Number((await searchParams).page ?? 1);
  const page = Number.isInteger(raw) && raw >= 1 && raw <= 3 ? raw : 1;
  const [coins, highlights] = await Promise.all([serverApi.coins(page), serverApi.highlights()]);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Today&apos;s crypto market
        </h1>
        <p className="text-muted text-sm">
          Live prices, charts and an AI assistant that answers with real market data.
        </p>
      </div>
      {page === 1 && <HighlightCards highlights={highlights.data} />}
      <MarketsSection page={page} initial={coins.data} snapshotAt={coins.meta.fetchedAt} />
    </div>
  );
}
