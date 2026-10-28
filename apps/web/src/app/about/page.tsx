import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How I built TRIYUAI",
  description: "Case study: a real-time crypto dashboard with an AI market assistant.",
};

const stack = [
  ["Frontend", "Next.js 15 (App Router), React 19, strict TypeScript, Tailwind CSS v4"],
  ["Data & state", "TanStack Query, TanStack Table, Zustand"],
  ["Real-time", "Binance public WebSocket with backoff and polling fallback"],
  ["Charts", "TradingView Lightweight Charts + custom SVG sparklines"],
  ["Mock API", "MSW with a Zod-typed contract shared with the future backend"],
  ["Backend (next)", "Express, PostgreSQL + Prisma, Upstash Redis, Groq / Gemini tool calling"],
];

const challenges = [
  {
    title: "Staying inside free API quotas",
    body: "CoinGecko's free tier allows 10,000 calls a month. The plan: on-demand caching in Redis, USD-only fetches with local currency conversion, and adaptive TTLs — while the top 20 coins stay real-time through Binance.",
  },
  {
    title: "Real-time without jank",
    body: "WebSocket ticks are batched every 500 ms into a Zustand store; only the affected price cells re-render and flash. Tabular numerals keep digits from shifting.",
  },
  {
    title: "Building the AI UI before the AI",
    body: "The chat streams Server-Sent Events from a mock that mimics tool calling, so the streaming, tool chips, stop and regenerate flows were finished before any LLM was wired up.",
  },
];

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-10">
      <header className="space-y-3">
        <p className="text-brand text-sm font-medium">Case study</p>
        <h1 className="text-3xl font-semibold tracking-tight">How I built TRIYUAI</h1>
        <p className="text-muted">
          A real-time crypto market dashboard with an AI market assistant, built to demonstrate
          production-grade frontend and full-stack skills: a fast data-heavy UI, live updates, AI
          streaming with tool calling, testing and a public deployment.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Features</h2>
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          {[
            "Top 250 market table with sorting, filtering and sparklines",
            "Live prices for the top 20 coins",
            "Coin pages with line & candlestick charts",
            "Ask TRIYU: streaming AI answers grounded in market data",
            "⌘K command palette search",
            "Watchlist, converter, dark mode, USD / IDR / EUR",
          ].map((f) => (
            <li key={f} className="border-border bg-surface rounded-xl border px-3 py-2.5">
              {f}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Architecture</h2>
        <dl className="divide-border border-border divide-y rounded-2xl border text-sm">
          {stack.map(([k, v]) => (
            <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-[160px_1fr]">
              <dt className="font-medium">{k}</dt>
              <dd className="text-muted">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Challenges</h2>
        {challenges.map((c) => (
          <div key={c.title}>
            <h3 className="font-medium">{c.title}</h3>
            <p className="text-muted mt-1 text-sm">{c.body}</p>
          </div>
        ))}
      </section>

      <section className="border-border bg-surface rounded-2xl border p-5 text-sm">
        <h2 className="font-semibold">Status</h2>
        <p className="text-muted mt-1">
          Phase 1 (frontend prototype on a mock API) is live. Next: automated testing, then the
          Express backend with auth, watchlist sync and the real AI. Read the{" "}
          <Link href="/disclaimer" className="text-brand underline">
            disclaimer
          </Link>
          .
        </p>
      </section>
    </article>
  );
}
