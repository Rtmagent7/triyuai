import request from "supertest";
import { describe, expect, it } from "vitest";
import { newsItemSchema } from "@triyuai/shared/news";
import { z } from "zod";
import { createTestContext } from "./helpers";

const rss = (items: { title: string; link: string; date: string; desc?: string }[]) =>
  `<?xml version="1.0"?><rss><channel>${items
    .map(
      (i) =>
        `<item><title><![CDATA[${i.title}]]></title><link>${i.link}</link><pubDate>${i.date}</pubDate><description>${i.desc ?? ""}</description></item>`,
    )
    .join("")}</channel></rss>`;

/** Answers each feed; `down` lists hosts that fail. */
function feeds(down: string[] = []) {
  const calls: string[] = [];
  const fake = (async (input: string | URL) => {
    const url = String(input);
    calls.push(url);
    if (down.some((d) => url.includes(d))) return new Response("nope", { status: 503 });
    if (url.includes("coindesk"))
      return new Response(
        rss([
          {
            title: "Bitcoin tops $80K",
            link: "https://www.coindesk.com/a?utm_source=rss",
            date: "Fri, 30 Oct 2026 10:00:00 +0000",
            desc: "&lt;p&gt;BTC &amp;amp; ETH rally&lt;/p&gt;",
          },
        ]),
      );
    if (url.includes("cointelegraph"))
      return new Response(
        rss([
          // The same story syndicated: de-duplicated by its cleaned URL.
          {
            title: "Bitcoin tops $80K",
            link: "https://www.coindesk.com/a?utm_medium=x",
            date: "Fri, 30 Oct 2026 10:00:00 +0000",
          },
          {
            title: "Solana upgrade ships",
            link: "https://cointelegraph.com/b",
            date: "Fri, 30 Oct 2026 12:00:00 +0000",
          },
        ]),
      );
    return new Response(rss([]));
  }) as typeof fetch;
  return { fake, calls };
}

describe("GET /news", () => {
  it("merges feeds newest first, de-duplicates, tags coins and filters by coin", async () => {
    const { fake } = feeds(["decrypt"]);
    const ctx = await createTestContext({ fetch: fake });
    const res = await request(ctx.app).get("/api/v1/news").expect(200);
    expect(() => z.array(newsItemSchema).parse(res.body.data)).not.toThrow();
    expect(res.body.meta).toMatchObject({ source: "rss", stale: false });
    expect(res.body.data.map((n: { title: string }) => n.title)).toEqual([
      "Solana upgrade ships",
      "Bitcoin tops $80K",
    ]);
    const btc = res.body.data[1];
    expect(btc).toMatchObject({ url: "https://www.coindesk.com/a", summary: "BTC & ETH rally" });
    expect(btc.coins).toEqual(expect.arrayContaining(["bitcoin", "ethereum"]));

    const sol = await request(ctx.app).get("/api/v1/news?coin=solana").expect(200);
    expect(sol.body.data.map((n: { title: string }) => n.title)).toEqual(["Solana upgrade ships"]);
    await request(ctx.app).get("/api/v1/news?coin=Not%20A%20Coin").expect(400);
  });

  it("caches the merged list", async () => {
    const { fake, calls } = feeds();
    const ctx = await createTestContext({ fetch: fake });
    await Promise.all([request(ctx.app).get("/api/v1/news"), request(ctx.app).get("/api/v1/news")]);
    await request(ctx.app).get("/api/v1/news").expect(200);
    expect(calls).toHaveLength(4);
  });

  it("serves the last good list when every feed fails, or 502 with none", async () => {
    const down = feeds(["coindesk", "cointelegraph", "decrypt", "theblock"]);
    const empty = await createTestContext({ fetch: down.fake });
    await request(empty.app).get("/api/v1/news").expect(502);

    const ctx = await createTestContext({ fetch: down.fake });
    await ctx.cache.set(
      "news:last",
      {
        items: [
          {
            id: "x",
            title: "Old",
            url: "https://x/",
            source: "coindesk",
            publishedAt: "2026-10-29T00:00:00.000Z",
            summary: "",
            coins: [],
          },
        ],
        fetchedAt: "2026-10-29T00:00:00.000Z",
      },
      60,
    );
    const res = await request(ctx.app).get("/api/v1/news").expect(200);
    expect(res.body.meta.stale).toBe(true);
    expect(res.body.data[0].title).toBe("Old");
  });
});

describe("Ask TRIYU getNews tool", () => {
  it("hands the model the coin's headlines and labels the chip with its name", async () => {
    const { mockModel, sseEvents } = await import("./helpers");
    const model = mockModel([
      { tools: [{ name: "getNews", input: { coinId: "solana" } }] },
      { text: "Done." },
    ]);
    const ctx = await createTestContext({ models: [{ name: "m", model }], fetch: feeds().fake });
    const res = await request(ctx.app)
      .post("/api/v1/ai/chat")
      .send({ messages: [{ role: "user", content: "news on SOL?" }] })
      .expect(200);
    const call = sseEvents(res.text).find((e) => e.type === "tool-call");
    expect(call).toMatchObject({ name: "getNews", label: "Fetched: Solana news" });
    // The tool result the model saw holds only Solana's story.
    const prompt = JSON.stringify(
      (model as unknown as { doStreamCalls: { prompt: unknown }[] }).doStreamCalls.at(-1)?.prompt,
    );
    expect(prompt).toContain("Solana upgrade ships");
    expect(prompt).not.toContain("Bitcoin tops");
  });
});
