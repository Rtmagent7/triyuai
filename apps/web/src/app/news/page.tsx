import type { Metadata } from "next";
import { NEWS_SOURCES } from "@triyuai/shared/news";
import { NewsView } from "@/components/news/news-list";
import { serverApi } from "@/lib/api/server";

export const revalidate = 600;
export const metadata: Metadata = {
  title: "Crypto news",
  description:
    "The latest crypto headlines from CoinDesk, Cointelegraph, Decrypt and The Block, with the coins each story mentions.",
};

export default async function NewsPage() {
  const [{ data: news }, { data: page }] = await Promise.all([
    serverApi.news(),
    serverApi.coins(1, 100),
  ]);
  const names = NEWS_SOURCES.map((s) => s.name);
  const sentence = `Headlines from ${names.slice(0, -1).join(", ")} and ${names.at(-1)}, newest first.`;
  const symbols = Object.fromEntries(page.coins.map((c) => [c.id, c.symbol.toUpperCase()]));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">News</h1>
        <p className="text-muted mt-1 max-w-2xl text-sm">
          {sentence} Each story opens on the publisher&apos;s site.
        </p>
      </div>
      <NewsView items={news} symbols={symbols} />
    </div>
  );
}
