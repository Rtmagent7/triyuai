import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CoinLogo } from "@/components/coin/coin-logo";
import { PriceChartLazy } from "@/components/coin/price-chart-lazy";
import { TradingChartLazy } from "@/components/trading/trading-chart-lazy";
import { NotFoundError, serverApi } from "@/lib/api/server";

export const revalidate = 300;

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
  return {
    title: `${coin.symbol}/USDT chart · Technical analysis`,
    description: `Interactive ${coin.name} (${coin.symbol}) candlestick chart with indicators (RSI, MACD, Bollinger Bands, moving averages) and drawing tools.`,
    alternates: { canonical: `/chart/${coin.id}` },
  };
}

/** Full-screen technical-analysis workspace (TradingView-style). */
export default async function ChartPage({ params }: Props) {
  const coin = await load((await params).id);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/coins/${coin.id}`}
          className="text-muted hover:text-text inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> {coin.name}
        </Link>
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <CoinLogo src={coin.image} name={coin.name} size={24} />
          {coin.symbol}/USDT chart
        </h1>
        <p className="text-muted ml-auto hidden text-xs md:block">
          Candles from Binance · layout saved in this browser · not financial advice
        </p>
      </div>
      <TradingChartLazy
        coinId={coin.id}
        ticker={coin.symbol}
        variant="full"
        className="h-[calc(100dvh-12rem)] min-h-[520px]"
        fallback={<PriceChartLazy coinId={coin.id} />}
      />
    </div>
  );
}
