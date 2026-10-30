import { z } from "zod";

/** Public RSS feeds (no key). Only headlines, a short summary and a link are shown. */
export const NEWS_SOURCES = [
  { id: "coindesk", name: "CoinDesk", feed: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
  { id: "cointelegraph", name: "Cointelegraph", feed: "https://cointelegraph.com/rss" },
  { id: "decrypt", name: "Decrypt", feed: "https://decrypt.co/feed" },
  { id: "theblock", name: "The Block", feed: "https://www.theblock.co/rss.xml" },
] as const;
export type NewsSourceId = (typeof NEWS_SOURCES)[number]["id"];
const SOURCE_IDS = NEWS_SOURCES.map((s) => s.id) as [NewsSourceId, ...NewsSourceId[]];

export const newsItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  source: z.enum(SOURCE_IDS),
  publishedAt: z.string(),
  /** Plain text, at most ~280 characters. */
  summary: z.string(),
  /** Coin ids the story mentions (top coins only). */
  coins: z.array(z.string()),
});
export type NewsItem = z.infer<typeof newsItemSchema>;

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

export const decodeEntities = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1]?.toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });

/** Text of an RSS field: CDATA unwrapped, tags and entities removed, whitespace collapsed. */
export function plainText(raw: string) {
  const unwrapped = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  // Entities first: some feeds escape their HTML (&lt;p&gt;), so tags appear after decoding.
  const decoded = decodeEntities(decodeEntities(unwrapped));
  return decoded
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const field = (item: string, tag: string) => {
  const m = item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? plainText(m[1]!) : "";
};

/** Drops tracking parameters so the same story from two feeds de-duplicates. */
export function cleanUrl(url: string) {
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) if (/^utm_|^ref$/i.test(k)) u.searchParams.delete(k);
    return u.toString();
  } catch {
    return url;
  }
}

/** A short, stable id for a URL (FNV-1a). */
export function urlId(url: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) {
    h ^= url.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export function shorten(text: string, max = 280) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)).trimEnd()}…`;
}

/** RSS 2.0 items → news items (coins untagged). Items without a title, link or date are skipped. */
export function parseRss(xml: string, source: NewsSourceId): Omit<NewsItem, "coins">[] {
  const out: Omit<NewsItem, "coins">[] = [];
  for (const m of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const item = m[1]!;
    const title = field(item, "title");
    const link = field(item, "link") || field(item, "guid");
    const date = new Date(field(item, "pubDate") || field(item, "dc:date"));
    if (!title || !/^https?:\/\//.test(link) || Number.isNaN(date.getTime())) continue;
    const url = cleanUrl(link);
    out.push({
      id: urlId(url),
      title,
      url,
      source,
      publishedAt: date.toISOString(),
      summary: shorten(field(item, "description")),
    });
  }
  return out;
}

/** Words that are also tickers or coin names but usually aren't about the coin. */
const AMBIGUOUS = new Set(["ONE", "SUN", "MOVE", "GAS", "S", "M", "U", "A", "B", "H", "Q", "OM", "TRUMP", "PI", "HYPE", "JUP", "W"]);

type CoinRef = { id: string; name: string; symbol: string };

/**
 * Coins a story mentions: a coin's full name, or its ticker in capitals (BTC, SOL).
 * Short or ambiguous tickers are matched by name only.
 */
export function tagCoins(text: string, coins: CoinRef[]) {
  const found: string[] = [];
  for (const c of coins) {
    const name = c.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const sym = c.symbol.toUpperCase();
    // Case-sensitive: coin names are proper nouns ("Render" the coin, not "render" the verb).
    const byName = c.name.length >= 4 && new RegExp(`(^|[^\\w])${name}([^\\w]|$)`).test(text);
    const bySymbol = sym.length >= 3 && !AMBIGUOUS.has(sym) && new RegExp(`(^|[^\\w$])\\$?${sym}([^\\w]|$)`).test(text);
    if (byName || bySymbol) found.push(c.id);
  }
  return found;
}

/** Merges feeds: one entry per story, newest first, tagged with the coins it mentions. */
export function mergeNews(
  feeds: Omit<NewsItem, "coins">[][],
  coins: CoinRef[],
  limit = 80,
): NewsItem[] {
  const byId = new Map<string, Omit<NewsItem, "coins">>();
  for (const feed of feeds) for (const item of feed) if (!byId.has(item.id)) byId.set(item.id, item);
  return [...byId.values()]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, limit)
    .map((n) => ({ ...n, coins: tagCoins(`${n.title} ${n.summary}`, coins) }));
}
