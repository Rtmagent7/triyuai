import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ExternalLink } from "lucide-react";
import { CoinHeader } from "@/components/coin/coin-header";
import { MiniConverter } from "@/components/coin/mini-converter";
import { PriceChartLazy } from "@/components/coin/price-chart-lazy";
import { TradingChartLazy } from "@/components/trading/trading-chart-lazy";
import { StatsGrid } from "@/components/coin/stats-grid";
import { CoinNews } from "@/components/news/news-list";
import { mockingEnabled } from "@/lib/api/mocking";
import { NotFoundError, serverApi } from "@/lib/api/server";
import { formatPercent, formatPrice } from "@/lib/format";
import { plainText, sanitizeDescription } from "@/lib/sanitize";
import { toSummary } from "@triyuai/shared/coingecko";

export const revalidate = 60;
export const dynamicParams = true;

/**
 * Prototype mode pre-renders the top 100 from fixtures. With the real API, pages render on
 * first visit and are cached (ISR): 100 detail calls at build time would hit CoinGecko's rate limit.
 */
export async function generateStaticParams() {
  if (!mockingEnabled) return [];
  return (await serverApi.topIds(100)).map((id) => ({ id }));
}

type Props = { params: Promise<{ id: string }> };

async function load(id: string) {
  try {
    return (await serverApi.coin(id)).data;
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const coin = await load((await params).id);
  const title = `${coin.name} (${coin.symbol}) price ${formatPrice(coin.price)}`;
  const description = `${coin.name} is ${(coin.change24h ?? 0) >= 0 ? "up" : "down"} ${formatPercent(coin.change24h)} in the last 24h. ${plainText(coin.description, 120)}`;
  return {
    title,
    description,
    alternates: { canonical: `/coins/${coin.id}` },
    openGraph: { title, description },
  };
}

export default async function CoinPage({ params }: Props) {
  const coin = await load((await params).id);
  const links = [
    coin.links.homepage && { label: "Website", href: coin.links.homepage },
    coin.links.whitepaper && { label: "Whitepaper", href: coin.links.whitepaper },
    ...coin.links.explorers
      .slice(0, 2)
      .map((href, i) => ({ label: i ? `Explorer ${i + 1}` : "Explorer", href })),
    coin.links.twitter && { label: "X / Twitter", href: coin.links.twitter },
    coin.links.reddit && { label: "Reddit", href: coin.links.reddit },
    coin.links.github && { label: "GitHub", href: coin.links.github },
  ].filter((l): l is { label: string; href: string } => !!l);

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-muted flex items-center gap-1 text-xs">
        <Link href="/" className="hover:text-text">
          Markets
        </Link>
        <ChevronRight className="size-3" />
        <span className="text-text">{coin.name}</span>
      </nav>

      <CoinHeader coin={coin} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          {/* Binance candles with indicators; coins without a USDT pair keep the CoinGecko chart. */}
          <TradingChartLazy
            coinId={coin.id}
            ticker={coin.symbol}
            variant="compact"
            fallback={<PriceChartLazy coinId={coin.id} />}
          />
          <section
            aria-labelledby="about-heading"
            className="border-border rounded-2xl border p-4 sm:p-5"
          >
            <h2 id="about-heading" className="mb-3 font-semibold">
              About {coin.name}
            </h2>
            <div
              className="prose-triyu text-text/90 max-w-3xl text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: sanitizeDescription(coin.description) }}
            />
            {coin.categories.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Categories">
                {coin.categories.map((c) => (
                  <li key={c} className="bg-surface-2 text-muted rounded-full px-2.5 py-1 text-xs">
                    {c}
                  </li>
                ))}
              </ul>
            )}
            {links.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2" aria-label="Links">
                {links.map((l) => (
                  <li key={l.href}>
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="border-border hover:bg-surface-2 inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium"
                    >
                      {l.label} <ExternalLink className="text-muted size-3" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <CoinNews coinId={coin.id} name={coin.name} />
        </div>
        {/* Sticky so the stats stay beside the long description instead of ending in a blank column. */}
        <aside className="space-y-6 self-start lg:sticky lg:top-20">
          <StatsGrid coin={coin} />
          <MiniConverter coin={toSummary(coin)} />
        </aside>
      </div>
    </div>
  );
}
