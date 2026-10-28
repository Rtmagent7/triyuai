/**
 * Mock "Ask TRIYU" brain (FR-25). Mimics the Phase 3 backend: picks tools by
 * intent, "runs" them against the fixture data, and streams a grounded answer.
 * Replaced by Vercel AI SDK + Groq tool calling in Phase 3.
 */
import type { ChatRequest, ChatStreamEvent, ChatToolName, Coin } from "@triyuai/shared";
import {
  formatCompact,
  formatPercent,
  formatPrice,
  formatSignedPercent,
  formatDate,
} from "@/lib/format";
import { useLivePrices } from "@/stores/live-prices";
import {
  findCoin as findSnapshotCoin,
  getGlobal,
  getHighlights,
  markets,
  snapshotAt,
} from "./data";

/** MSW runs in the page, so the mock can quote the live Binance price like the real backend will. */
function withLive(coin: Coin): Coin {
  const tick = useLivePrices.getState().ticks[coin.id];
  return tick ? { ...coin, price: tick.price, change24h: tick.change24h } : coin;
}

const findCoin = (id: string) => {
  const coin = findSnapshotCoin(id);
  return coin && withLive(coin);
};

type Plan = { tools: { name: ChatToolName; label: string }[]; text: string; live?: boolean };

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "can",
  "do",
  "for",
  "how",
  "i",
  "in",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "so",
  "the",
  "to",
  "up",
  "vs",
  "was",
  "what",
  "why",
  "will",
  "with",
  "you",
  "today",
  "now",
  "best",
  "top",
  "one",
  "any",
  "all",
  "more",
  "most",
]);

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Finds coins mentioned by name or ticker, ordered by first mention. */
export function detectCoins(text: string): Coin[] {
  const lower = text.toLowerCase();
  const tokens: string[] = lower.match(/[a-z0-9.-]+/g) ?? [];
  const hits = new Map<string, { coin: Coin; pos: number }>();
  for (const coin of markets) {
    const name = coin.name.toLowerCase();
    const namePos = name.length > 2 ? lower.search(new RegExp(`\\b${escapeRegex(name)}\\b`)) : -1;
    const sym = coin.symbol.toLowerCase();
    const symIdx = STOP_WORDS.has(sym) || sym.length < 2 ? -1 : tokens.indexOf(sym);
    const symPos = symIdx >= 0 ? lower.indexOf(sym) : -1;
    const pos = [namePos, symPos].filter((p) => p >= 0).sort((a, b) => a - b)[0];
    if (pos !== undefined && !hits.has(coin.id)) hits.set(coin.id, { coin, pos });
  }
  // Prefer the highest-ranked coin when a ticker is ambiguous (e.g. several "SOL"s).
  const seenSymbols = new Set<string>();
  return [...hits.values()]
    .sort((a, b) => a.pos - b.pos || (a.coin.rank ?? 999) - (b.coin.rank ?? 999))
    .filter(({ coin }) => {
      if (seenSymbols.has(coin.symbol)) return false;
      seenSymbols.add(coin.symbol);
      return true;
    })
    .map((h) => withLive(h.coin));
}

const asOf = (live: boolean) => {
  const at = new Date(snapshotAt).toUTCString().replace("GMT", "UTC");
  return live
    ? `\n\n_Prices live from Binance; other data as of ${at} (prototype snapshot). Not financial advice._`
    : `\n\n_Data as of ${at} (prototype snapshot). Not financial advice._`;
};

const isLive = (coins: (Coin | undefined)[]) =>
  coins.some((c) => c && useLivePrices.getState().ticks[c.id]);

const pct = (n: number | null) => (n == null ? "n/a" : `${n >= 0 ? "▲" : "▼"} ${formatPercent(n)}`);

function coinAnswer(coin: Coin, question: string): string {
  const g = getGlobal().data;
  const why = /\bwhy\b|\breason\b|\bmoving\b|\bdown\b|\bup\b|\bdump|\bpump/.test(question);
  const lines = [
    `**${coin.name} (${coin.symbol})** is trading at **${formatPrice(coin.price)}**, ranked **#${coin.rank}** by market cap.`,
    "",
    "| Metric | Value |",
    "| --- | --- |",
    `| 1h | ${pct(coin.change1h)} |`,
    `| 24h | ${pct(coin.change24h)} |`,
    `| 7d | ${pct(coin.change7d)} |`,
    `| Market cap | ${formatCompact(coin.marketCap)} |`,
    `| 24h volume | ${formatCompact(coin.volume24h)} |`,
    `| 24h range | ${formatPrice(coin.low24h)} – ${formatPrice(coin.high24h)} |`,
    `| All-time high | ${formatPrice(coin.ath)} (${formatDate(coin.athDate)}, ${formatSignedPercent(coin.athChangePct, 1)} from ATH) |`,
  ];
  if (why) {
    const rel = (coin.change24h ?? 0) - g.marketCapChange24h;
    lines.push(
      "",
      `Over the last 24 hours the whole market moved ${formatSignedPercent(g.marketCapChange24h)}, so ${coin.symbol} ${
        Math.abs(rel) < 1.5
          ? "is mostly **moving with the market** rather than on coin-specific news."
          : rel > 0
            ? `is **outperforming** the market by about ${formatPercent(rel, 1)}.`
            : `is **underperforming** the market by about ${formatPercent(rel, 1)}.`
      }`,
      `Volume is ${formatCompact(coin.volume24h)}, about ${formatPercent((coin.volume24h / coin.marketCap) * 100, 1)} of its market cap${
        coin.volume24h / coin.marketCap > 0.1 ? " — unusually active trading." : "."
      }`,
      "",
      "I can't see news headlines in this prototype, so treat this as a data-only read of the move.",
    );
  }
  return lines.join("\n");
}

function compareAnswer(coins: Coin[]): string {
  const head = `| Metric | ${coins.map((c) => c.symbol).join(" | ")} |`;
  const sep = `| --- | ${coins.map(() => "---").join(" | ")} |`;
  const row = (label: string, f: (c: Coin) => string) =>
    `| ${label} | ${coins.map(f).join(" | ")} |`;
  const best7d = [...coins].sort((a, b) => (b.change7d ?? 0) - (a.change7d ?? 0))[0]!;
  const biggest = [...coins].sort((a, b) => b.marketCap - a.marketCap)[0]!;
  return [
    `Here's a side-by-side of ${coins.map((c) => `**${c.name}**`).join(" and ")}:`,
    "",
    head,
    sep,
    row("Price", (c) => formatPrice(c.price)),
    row("Rank", (c) => `#${c.rank}`),
    row("24h", (c) => pct(c.change24h)),
    row("7d", (c) => pct(c.change7d)),
    row("Market cap", (c) => formatCompact(c.marketCap)),
    row("24h volume", (c) => formatCompact(c.volume24h)),
    row("From ATH", (c) => formatSignedPercent(c.athChangePct, 1)),
    "",
    `- **${biggest.name}** is the larger asset by market cap.`,
    `- **${best7d.name}** has the stronger 7-day performance (${formatSignedPercent(best7d.change7d)}).`,
  ].join("\n");
}

function overviewAnswer(): string {
  const g = getGlobal().data;
  const h = getHighlights().data;
  const list = (items: { name: string; symbol: string; change24h: number | null }[]) =>
    items.map((c) => `- **${c.name}** (${c.symbol}) ${pct(c.change24h)}`).join("\n");
  const mood =
    g.marketCapChange24h > 1 ? "risk-on" : g.marketCapChange24h < -1 ? "risk-off" : "fairly quiet";
  return [
    `The crypto market is **${mood}** today: total market cap is **${formatCompact(g.totalMarketCap)}** (${pct(g.marketCapChange24h)} in 24h) on **${formatCompact(g.totalVolume24h)}** of volume.`,
    `Bitcoin dominance sits at **${formatPercent(g.btcDominance, 1)}**, Ethereum at **${formatPercent(g.ethDominance, 1)}**.`,
    "",
    "### Top gainers (24h)",
    list(h.gainers.slice(0, 3)),
    "",
    "### Top losers (24h)",
    list(h.losers.slice(0, 3)),
    "",
    `### Trending searches`,
    h.trending
      .slice(0, 3)
      .map((c) => `- ${c.name} (${c.symbol})`)
      .join("\n"),
  ].join("\n");
}

const EDUCATION: { match: RegExp; text: string }[] = [
  {
    match: /fdv|fully diluted|market cap vs|market cap and/,
    text: [
      "**Market cap** = current price × **circulating** supply — what the coins that exist on the market today are worth.",
      "",
      "**FDV (fully diluted valuation)** = current price × **maximum** (or total) supply — what the project would be worth if every token that will ever exist were already circulating.",
      "",
      "| | Market cap | FDV |",
      "| --- | --- | --- |",
      "| Supply used | Circulating | Max / total |",
      "| Answers | What is it worth now? | What if all tokens unlocked? |",
      "",
      "A large gap between FDV and market cap means many tokens are still locked or unissued. Future unlocks can add selling pressure, so it's worth checking the vesting schedule.",
    ].join("\n"),
  },
  {
    match: /dominance/,
    text: "**Bitcoin dominance** is BTC's share of the total crypto market cap. Rising dominance usually means money is rotating into Bitcoin (often in cautious markets); falling dominance often signals appetite for altcoins.",
  },
  {
    match: /volume/,
    text: "**24h volume** is the total value traded in the last 24 hours across exchanges. High volume relative to market cap means a coin is actively traded and easier to buy or sell without moving the price.",
  },
];

const ADVICE =
  /\b(should i (buy|sell|invest)|buy or sell|is it a good (time|investment)|price prediction|predict|will .* (go|reach|hit)|financial advice|all in)\b/;

export function planAnswer(req: ChatRequest): Plan {
  const last = req.messages[req.messages.length - 1]!.content;
  const q = last.toLowerCase();

  if (ADVICE.test(q)) {
    const coins = detectCoins(last);
    const coin = coins[0] ?? (req.context ? findCoin(req.context.coinId) : undefined);
    return {
      live: isLive([coin]),
      tools: coin ? [{ name: "getCoinDetails", label: `Fetched: ${coin.name} price` }] : [],
      text: [
        "I can't tell you whether to buy, sell or hold — I'm a market-data assistant, not a financial adviser, and nobody can reliably predict prices.",
        "",
        coin
          ? `What I can share is the current picture: **${coin.name}** is at **${formatPrice(coin.price)}** (${pct(coin.change24h)} 24h, ${pct(coin.change7d)} 7d) and ${formatSignedPercent(coin.athChangePct, 1)} from its all-time high.`
          : "What I can do is show you prices, trends, comparisons and explain concepts so you can make your own decision.",
        "",
        "Consider your own risk tolerance, only invest what you can afford to lose, and do your own research.",
      ].join("\n"),
    };
  }

  const edu = EDUCATION.find((e) => e.match.test(q) && /explain|what|difference|mean|vs/.test(q));
  if (edu) return { tools: [], text: edu.text };

  let coins = detectCoins(last);
  // Follow-ups like "and its ATH?" refer to the coin from earlier turns or the page context.
  if (!coins.length && !/market|today|overview|gainer|loser|trend/.test(q)) {
    const earlier = [...req.messages]
      .reverse()
      .slice(1)
      .map((m) => detectCoins(m.content))
      .find((c) => c.length);
    const ctx = req.context ? findCoin(req.context.coinId) : undefined;
    coins = earlier ?? (ctx ? [ctx] : []);
  }

  if (coins.length >= 2) {
    const pick = coins.slice(0, 3);
    return {
      live: isLive(pick),
      tools: [
        { name: "compareCoins", label: `Fetched: ${pick.map((c) => c.symbol).join(" vs ")} data` },
      ],
      text: compareAnswer(pick),
    };
  }

  if (coins.length === 1) {
    const coin = coins[0]!;
    return {
      live: isLive([coins[0]]),
      tools: [
        { name: "getCoinDetails", label: `Fetched: ${coin.name} price` },
        ...(/\bwhy\b|moving|down|up/.test(q)
          ? [{ name: "getMarketOverview" as const, label: "Fetched: market overview" }]
          : []),
      ],
      text: coinAnswer(coin, q),
    };
  }

  if (/market|today|moving|overview|gainer|loser|trend|happening|pump|dump/.test(q)) {
    return {
      tools: [
        { name: "getMarketOverview", label: "Fetched: market overview" },
        { name: "getTopMovers", label: "Fetched: top movers" },
      ],
      text: overviewAnswer(),
    };
  }

  const guess = q.match(/[a-z0-9]{3,}/g)?.find((w) => !STOP_WORDS.has(w));
  return {
    tools: guess ? [{ name: "searchCoin", label: `Searched: "${guess}"` }] : [],
    text: [
      "I couldn't match that to a coin in the top 250. Here's what I can help with:",
      "",
      '- **Prices & stats** — "How is Solana doing?"',
      '- **Market overview** — "What\'s moving the market today?"',
      '- **Comparisons** — "Compare BTC and ETH"',
      '- **Concepts** — "Explain market cap vs FDV"',
    ].join("\n"),
  };
}

/** Splits text into word-ish chunks so the UI receives a token-by-token stream. */
export function tokenize(text: string): string[] {
  return text.match(/\S+\s*|\s+/g) ?? [];
}

export function* answerEvents(
  req: ChatRequest,
): Generator<{ event: ChatStreamEvent; delay: number }> {
  const plan = planAnswer(req);
  for (const [i, tool] of plan.tools.entries()) {
    const id = `call_${i}`;
    yield { event: { type: "tool-call", id, name: tool.name, label: tool.label }, delay: 250 };
    yield { event: { type: "tool-result", id }, delay: 450 + i * 150 };
  }

  for (const token of tokenize(plan.text + asOf(!!plan.live))) {
    yield { event: { type: "text-delta", delta: token }, delay: 12 + Math.random() * 28 };
  }
  yield { event: { type: "finish", fetchedAt: snapshotAt }, delay: 0 };
}
