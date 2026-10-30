import { stepCountIs, streamText, tool, type LanguageModel, type ModelMessage } from "ai";
import { z } from "zod";
import {
  coinIdSchema,
  type ChatRequest,
  type ChatStreamEvent,
  type ChatToolName,
  type Coin,
} from "@triyuai/shared";
import { fetchFearGreed, fgAgo, type FearGreedPoint } from "@triyuai/shared/fear-greed";
import { SECTORS, primarySector, type SectorId } from "@triyuai/shared/sectors";
import { altcoinsVsBitcoin, dominance, sectorStats, statsFor } from "@triyuai/shared/sector-stats";
import type { Logger } from "../lib/logger";
import type { MarketService } from "../services/market";

const SYSTEM = `You are TRIYU, the AI assistant of TRIYUAI, a crypto market dashboard.

Rules:
- For any price, market cap, volume, ranking or % change, call a tool first. Never invent or recall numbers from memory.
- Answer in the user's language, in short Markdown: a one-line summary, then bullets or a table. Bold the coin name.
- Mention when the data was fetched (UTC) and that prices move quickly.
- You never give financial advice: no buy/sell/hold calls, price targets or predictions. If asked, say so politely and offer neutral facts (recent performance, volatility, what drives the price) instead.
- Explain crypto concepts (market cap, FDV, halving, stablecoins, …) plainly for beginners.
- For market mood, Fear & Greed, BTC/USDT/stablecoin dominance or "altcoin season", call getSentiment.
- For sectors or categories (meme coins, AI, RWA, Layer 1, DeFi…), call getSectorPerformance.
- If a coin is unknown, use searchCoin. If the question is not about crypto or markets, say you can only help with crypto markets.
- End answers that discuss specific coins with: "_Not financial advice._"`;

/** Compact coin facts for the model (fewer tokens than the full contract object). */
const facts = (c: Coin) => ({
  id: c.id,
  name: c.name,
  symbol: c.symbol,
  rank: c.rank,
  priceUsd: c.price,
  change1hPct: c.change1h,
  change24hPct: c.change24h,
  change7dPct: c.change7d,
  marketCapUsd: c.marketCap,
  volume24hUsd: c.volume24h,
  high24hUsd: c.high24h,
  low24hUsd: c.low24h,
  athUsd: c.ath,
  athDate: c.athDate,
  athChangePct: c.athChangePct,
  circulatingSupply: c.circulatingSupply,
  maxSupply: c.maxSupply,
});

export type ChatService = ReturnType<typeof createChatService>;

export function createChatService(deps: {
  market: MarketService;
  /** Tried in order: the next model is used when one fails before streaming anything. */
  models: { name: string; model: LanguageModel }[];
  logger: Logger;
}) {
  const { market, logger } = deps;

  // The Fear & Greed index changes once a day; one fetch per half hour is plenty.
  let fearGreed: { at: number; points: FearGreedPoint[] } | null = null;
  async function fearGreedPoints() {
    if (fearGreed && Date.now() - fearGreed.at < 30 * 60_000) return fearGreed.points;
    const points = await fetchFearGreed(31);
    fearGreed = { at: Date.now(), points };
    return points;
  }

  function buildTools(track: (fetchedAt: string) => void) {
    const nameOf = async (id: string) =>
      (await market.markets().catch(() => null))?.data.find((c) => c.id === id)?.name ?? id;

    return {
      tools: {
        getMarketOverview: tool({
          description:
            "Global crypto market stats, the top 5 coins by market cap and today's biggest movers.",
          inputSchema: z.object({}),
          execute: async () => {
            const [g, h, top] = await Promise.all([
              market.global(),
              market.highlights(),
              market.markets(),
            ]);
            track(g.meta.fetchedAt);
            return {
              fetchedAt: g.meta.fetchedAt,
              global: g.data,
              top5: top.data.slice(0, 5).map(facts),
              topGainers: h.data.gainers.slice(0, 3),
              topLosers: h.data.losers.slice(0, 3),
            };
          },
        }),
        getCoinDetails: tool({
          description: "Live market data for one coin by CoinGecko id (e.g. bitcoin, solana).",
          inputSchema: z.object({ coinId: coinIdSchema }),
          execute: async ({ coinId }) => {
            const r = await market.coin(coinId).catch(() => null);
            if (!r) return { error: `Unknown coin id "${coinId}". Use searchCoin.` };
            track(r.meta.fetchedAt);
            return {
              fetchedAt: r.meta.fetchedAt,
              ...facts(r.data),
              categories: r.data.categories,
              description: r.data.description.replace(/<[^>]+>/g, "").slice(0, 600),
            };
          },
        }),
        getTopMovers: tool({
          description: "Top gainers or losers over 24h among the top 250 coins (volume > $1M).",
          inputSchema: z.object({
            direction: z.enum(["gainers", "losers"]),
            limit: z.number().int().min(1).max(10).default(5),
          }),
          execute: async ({ direction, limit }) => {
            const h = await market.highlights();
            track(h.meta.fetchedAt);
            return { fetchedAt: h.meta.fetchedAt, coins: h.data[direction].slice(0, limit) };
          },
        }),
        searchCoin: tool({
          description: "Finds coins by name or ticker. Returns ids to use with the other tools.",
          inputSchema: z.object({ query: z.string().min(1).max(50) }),
          execute: async ({ query }) => {
            const r = await market.search(query, 5);
            return { results: r.data };
          },
        }),
        compareCoins: tool({
          description: "Side-by-side market data for 2 to 4 coins by CoinGecko id.",
          inputSchema: z.object({ coinIds: z.array(coinIdSchema).min(2).max(4) }),
          execute: async ({ coinIds }) => {
            const r = await market.coinsByIds(coinIds);
            track(r.meta.fetchedAt);
            return { fetchedAt: r.meta.fetchedAt, coins: r.data.map(facts) };
          },
        }),
        getSentiment: tool({
          description:
            "Crypto Fear & Greed Index (today, yesterday, last week, last month), BTC/ETH/USDT/stablecoin dominance and how many of the top 50 altcoins beat Bitcoin over 7 days.",
          inputSchema: z.object({}),
          execute: async () => {
            const [g, top, points] = await Promise.all([
              market.global(),
              market.markets(),
              fearGreedPoints().catch(() => null),
            ]);
            track(g.meta.fetchedAt);
            const read = (d: number) => {
              const p = points && fgAgo(points, d);
              return p ? { value: p.value, label: p.label } : null;
            };
            const alts = altcoinsVsBitcoin(top.data);
            return {
              fetchedAt: g.meta.fetchedAt,
              fearGreed: points
                ? { today: read(0), yesterday: read(1), lastWeek: read(7), lastMonth: read(30) }
                : "unavailable",
              dominancePct: dominance(g.data, top.data).map((d) => ({ [d.label]: d.share })),
              altcoinsBeatingBitcoin7d: alts && {
                beat: alts.beat,
                of: alts.total,
                bitcoinChange7dPct: alts.btcChange7d,
              },
            };
          },
        }),
        getSectorPerformance: tool({
          description:
            "Sector performance among the top 250 coins (market-cap-weighted 24h/7d change, market cap). With a sector id, also its largest coins.",
          inputSchema: z.object({
            sector: z
              .enum(SECTORS.map((x) => x.id) as [SectorId, ...SectorId[]])
              .optional()
              .describe("Omit for every sector."),
          }),
          execute: async ({ sector }) => {
            const top = await market.markets();
            track(top.meta.fetchedAt);
            const row = (s: ReturnType<typeof statsFor>) => ({
              sector: s.sector.label,
              id: s.sector.id,
              coins: s.coins.length,
              marketCapUsd: s.marketCap,
              change24hPct: s.change24h,
              change7dPct: s.change7d,
            });
            if (!sector)
              return { fetchedAt: top.meta.fetchedAt, sectors: sectorStats(top.data).map(row) };
            const s = statsFor(
              SECTORS.find((x) => x.id === sector)!,
              top.data,
            );
            return {
              fetchedAt: top.meta.fetchedAt,
              ...row(s),
              about: s.sector.blurb,
              largest: s.coins.slice(0, 8).map((c) => ({
                ...facts(c),
                primarySector: primarySector(c.id)?.label,
              })),
            };
          },
        }),
      },

      /** Chip text shown while a tool runs, e.g. "Fetched: Solana price". */
      async label(name: ChatToolName, input: Record<string, unknown>): Promise<string> {
        switch (name) {
          case "getCoinDetails":
            return `Fetched: ${await nameOf(String(input.coinId))} price`;
          case "getTopMovers":
            return `Fetched: top ${input.direction === "losers" ? "losers" : "gainers"}`;
          case "searchCoin":
            return `Searched: "${String(input.query)}"`;
          case "compareCoins": {
            const ids = (input.coinIds as string[] | undefined) ?? [];
            const top = (await market.markets().catch(() => null))?.data ?? [];
            const sym = (id: string) => top.find((c) => c.id === id)?.symbol ?? id;
            return `Fetched: ${ids.map(sym).join(" vs ")} data`;
          }
          case "getSentiment":
            return "Fetched: Fear & Greed and dominance";
          case "getSectorPerformance": {
            const id = input.sector as string | undefined;
            const label = SECTORS.find((x) => x.id === id)?.label;
            return label ? `Fetched: ${label} sector` : "Fetched: sector performance";
          }
          default:
            return "Fetched: market overview";
        }
      },
    };
  }

  return {
    enabled: deps.models.length > 0,

    async *stream(req: ChatRequest, signal?: AbortSignal): AsyncGenerator<ChatStreamEvent> {
      let oldest: string | null = null;
      const track = (at: string) => {
        if (!oldest || at < oldest) oldest = at;
      };
      const { tools, label } = buildTools(track);

      let system = SYSTEM;
      if (req.context?.coinId) {
        const name = await market
          .coin(req.context.coinId)
          .then((r) => r.data.name)
          .catch(() => req.context!.coinId);
        system += `\n\nThe user is on the ${name} page (id: ${req.context.coinId}); "it" or "this coin" means ${name}.`;
      }
      const messages: ModelMessage[] = req.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      for (const [i, { name, model }] of deps.models.entries()) {
        let emitted = false;
        try {
          const result = streamText({
            model,
            system,
            messages,
            tools,
            stopWhen: stepCountIs(4),
            maxRetries: 0,
            abortSignal: signal,
            // Errors surface as "error" stream parts and are handled below.
            onError: () => {},
          });
          for await (const part of result.fullStream) {
            if (part.type === "tool-call") {
              emitted = true;
              const toolName = part.toolName as ChatToolName;
              yield {
                type: "tool-call",
                id: part.toolCallId,
                name: toolName,
                label: await label(toolName, (part.input ?? {}) as Record<string, unknown>),
              };
            } else if (part.type === "tool-result" || part.type === "tool-error") {
              yield { type: "tool-result", id: part.toolCallId };
            } else if (part.type === "text-delta" && part.text) {
              emitted = true;
              yield { type: "text-delta", delta: part.text };
            } else if (part.type === "error") {
              throw part.error;
            }
          }
          yield { type: "finish", fetchedAt: oldest ?? new Date().toISOString() };
          return;
        } catch (err) {
          if (signal?.aborted) return;
          const last = i === deps.models.length - 1;
          logger.warn({ err, model: name, emitted }, "AI model failed");
          // Falling back mid-answer would duplicate text, so only fail over before output.
          if (emitted || last) {
            yield {
              type: "error",
              code: "AI_FAILED",
              message: "Ask TRIYU couldn't finish this answer. Please try again.",
            };
            return;
          }
        }
      }
    },
  };
}
