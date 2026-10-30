import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  apiResponse,
  chartDataSchema,
  coinDetailSchema,
  coinSchema,
  coinSummarySchema,
  coinsPageSchema,
  exchangeSchema,
  globalStatsSchema,
  highlightsSchema,
  ratesSchema,
} from "@triyuai/shared";
import { z } from "zod";
import { MemoryCache } from "../src/cache";
import { UpstreamError } from "../src/lib/errors";
import { createCoinGecko, usageKey } from "../src/services/coingecko";
import { TTL } from "../src/services/market";
import { createTestContext, type TestContext } from "./helpers";

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestContext();
});
beforeEach(async () => {
  ctx.cg.calls.length = 0;
  ctx.cg.state.fail = null;
  // Clear cached market keys per test; snapshots in Postgres persist on purpose.
  for (const key of [
    "cg:markets:usd",
    "cg:global",
    "cg:trending",
    "cg:rates",
    "cg:coin:bitcoin",
    "cg:search:sol",
  ]) {
    await ctx.cache.del(key);
  }
});

/** Contract tests: every response must match the shared Zod schema the frontend relies on. */
describe("market endpoints follow the API contract", () => {
  it.each([
    ["/api/v1/global", globalStatsSchema],
    ["/api/v1/rates", ratesSchema],
    ["/api/v1/coins?page=1&perPage=5", coinsPageSchema],
    ["/api/v1/coins?ids=bitcoin,solana", z.array(coinSchema)],
    ["/api/v1/coins/bitcoin", coinDetailSchema],
    ["/api/v1/coins/bitcoin/chart?range=1m", chartDataSchema],
    ["/api/v1/highlights", highlightsSchema],
    ["/api/v1/search?q=sol", z.array(coinSummarySchema)],
  ])("GET %s", async (url, schema) => {
    const res = await request(ctx.app).get(url).expect(200);
    expect(() => apiResponse(schema).parse(res.body)).not.toThrow();
    expect(res.body.meta).toMatchObject({ source: "coingecko", stale: false });
    expect(res.headers["cache-control"]).toContain("s-maxage=60");
  });
});

describe("market data", () => {
  it("ranks exchanges and values their BTC volume in USD", async () => {
    const res = await request(ctx.app).get("/api/v1/exchanges").expect(200);
    expect(() => z.array(exchangeSchema).parse(res.body.data)).not.toThrow();
    const btc = (await request(ctx.app).get("/api/v1/coins?ids=bitcoin").expect(200)).body.data[0]
      .price;
    expect(res.body.data[0]).toMatchObject({
      id: "kraken",
      trustScore: 10,
      volume24hBtc: 2,
      volume24hUsd: 2 * btc,
      yearEstablished: 2011,
    });
    // Missing fields stay explicit nulls / zero rather than empty strings.
    expect(res.body.data[1]).toMatchObject({ country: null, trustScore: null, volume24hUsd: 0 });
    // Cached: a second request does not call CoinGecko again.
    const before = ctx.cg.calls.filter((c) => c === "/exchanges").length;
    await request(ctx.app).get("/api/v1/exchanges").expect(200);
    expect(ctx.cg.calls.filter((c) => c === "/exchanges").length).toBe(before);
  });

  it("paginates the top list and maps CoinGecko fields", async () => {
    const res = await request(ctx.app).get("/api/v1/coins?page=2&perPage=5").expect(200);
    expect(res.body.data).toMatchObject({ page: 2, perPage: 5, total: 12 });
    expect(res.body.data.coins.map((c: { id: string }) => c.id)).toEqual([
      "cardano",
      "polkadot",
      "litecoin",
      "uniswap",
      "stellar",
    ]);
    expect(res.body.data.coins[0]).toMatchObject({ symbol: "CAR", rank: 6 });
  });

  it("rejects invalid queries", async () => {
    await request(ctx.app).get("/api/v1/coins?page=9").expect(400);
    await request(ctx.app).get("/api/v1/coins/Not_Valid!").expect(400);
    await request(ctx.app).get("/api/v1/coins/bitcoin/chart?range=5y").expect(400);
    const res = await request(ctx.app).get("/api/v1/coins?ids=a,B").expect(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });

  it("returns 404 for unknown coins", async () => {
    const res = await request(ctx.app).get("/api/v1/coins/missing-coin").expect(404);
    expect(res.body).toEqual({ error: { code: "NOT_FOUND", message: "Coin not found" } });
  });

  it("caches responses so repeat requests do not call CoinGecko", async () => {
    await request(ctx.app).get("/api/v1/global").expect(200);
    await request(ctx.app).get("/api/v1/global").expect(200);
    await request(ctx.app).get("/api/v1/coins?page=1").expect(200);
    await request(ctx.app).get("/api/v1/coins?page=2&perPage=5").expect(200);
    expect(ctx.cg.calls.filter((c) => c === "/global")).toHaveLength(1);
    expect(ctx.cg.calls.filter((c) => c === "/coins/markets")).toHaveLength(1);
  });

  it("shares one upstream call between concurrent cache misses", async () => {
    await Promise.all([1, 2, 3].map(() => request(ctx.app).get("/api/v1/rates").expect(200)));
    expect(ctx.cg.calls.filter((c) => c === "/exchange_rates")).toHaveLength(1);
  });

  it("fetches coins outside the top list by id", async () => {
    const res = await request(ctx.app)
      .get("/api/v1/coins?ids=bitcoin,extra-coin,unknown")
      .expect(200);
    expect(res.body.data.map((c: { id: string }) => c.id)).toEqual(["bitcoin", "extra-coin"]);
    expect(ctx.cg.calls).toContain("/coins/markets?ids=extra-coin,unknown");
  });

  it("searches the top list first, then CoinGecko search", async () => {
    const top = await request(ctx.app).get("/api/v1/search?q=bitcoin").expect(200);
    expect(top.body.data[0]).toMatchObject({ id: "bitcoin" });

    const res = await request(ctx.app).get("/api/v1/search?q=sol").expect(200);
    expect(res.body.data.map((c: { id: string }) => c.id)).toEqual(["solana", "extra-sol-fork"]);
    expect(ctx.cg.calls).toContain("/search?query=sol");

    const empty = await request(ctx.app).get("/api/v1/search?q=").expect(200);
    expect(empty.body.data).toEqual([]);
  });

  it("keeps local search results when CoinGecko search fails", async () => {
    await request(ctx.app).get("/api/v1/coins").expect(200);
    ctx.cg.state.fail = new UpstreamError(429);
    const res = await request(ctx.app).get("/api/v1/search?q=cardano").expect(200);
    expect(res.body.data.map((c: { id: string }) => c.id)).toEqual(["cardano"]);
  });

  it("builds highlights from the market list and trending", async () => {
    const { body } = await request(ctx.app).get("/api/v1/highlights").expect(200);
    expect(body.data.trending.map((c: { id: string }) => c.id)).toEqual(["solana", "brett"]);
    // The trending coin in the top list uses the market price, not the trending payload.
    expect(body.data.trending[0].price).toBeCloseTo(1000 / 3);
    expect(body.data.trending[1]).toMatchObject({ price: 0.05, change24h: 12 });
    expect(body.data.gainers[0].change24h).toBeGreaterThan(body.data.gainers[1].change24h);
    expect(body.data.losers[0].change24h).toBeLessThan(0);
    expect(body.data.highestVolume[0]).toMatchObject({ id: "bitcoin" });
  });

  it("maps coin detail links, categories and description", async () => {
    const { body } = await request(ctx.app).get("/api/v1/coins/solana").expect(200);
    expect(body.data).toMatchObject({
      id: "solana",
      symbol: "SOL",
      hasFullDetail: true,
      categories: ["Layer 1"],
      links: {
        homepage: "https://example.com",
        whitepaper: null,
        explorers: ["https://explorer.test"],
        twitter: "https://x.com/solana",
        reddit: null,
        github: "https://github.com/solana",
      },
    });
    expect(body.data.sparkline7d).toEqual([1, 3]);
  });

  it("converts BTC-based exchange rates to USD-based", async () => {
    const { body } = await request(ctx.app).get("/api/v1/rates").expect(200);
    expect(body.data).toEqual({ usd: 1, idr: 16_000, eur: 0.92 });
  });

  it("serves charts with derived candles; MAX falls back to 1 year without an API key", async () => {
    const { body } = await request(ctx.app)
      .get("/api/v1/coins/bitcoin/chart?range=max")
      .expect(200);
    expect(body.data.range).toBe("max");
    expect(body.data.line).toHaveLength(365 * 24 + 1);
    expect(body.data.ohlc.length).toBeGreaterThan(80);
    expect(body.data.ohlc[1].open).toBe(body.data.ohlc[0].close);

    const day = await request(ctx.app).get("/api/v1/coins/bitcoin/chart?range=24h").expect(200);
    const times = day.body.data.line.map((p: { time: number }) => p.time);
    expect(times.at(-1) - times[0]).toBeLessThanOrEqual(86_400);
  });
});

describe("snapshot fallback (PRD §11)", () => {
  it("serves the last good copy with stale: true when CoinGecko fails", async () => {
    const fresh = await request(ctx.app).get("/api/v1/global").expect(200);
    await ctx.cache.del("cg:global");
    ctx.cg.state.fail = new UpstreamError(429);

    const res = await request(ctx.app).get("/api/v1/global").expect(200);
    expect(res.body.data).toEqual(fresh.body.data);
    expect(res.body.meta).toEqual({
      fetchedAt: fresh.body.meta.fetchedAt,
      source: "snapshot",
      stale: true,
    });

    // The snapshot is re-served from cache briefly instead of retrying CoinGecko on every request.
    const callsBefore = ctx.cg.calls.length;
    await request(ctx.app).get("/api/v1/global").expect(200);
    expect(ctx.cg.calls.length).toBe(callsBefore);
  });

  it("builds a market-only coin detail when the coin endpoint fails without a snapshot", async () => {
    await request(ctx.app).get("/api/v1/coins").expect(200);
    ctx.cg.state.fail = new UpstreamError(429);
    const { body } = await request(ctx.app).get("/api/v1/coins/litecoin").expect(200);
    expect(() => apiResponse(coinDetailSchema).parse(body)).not.toThrow();
    expect(body.data).toMatchObject({ id: "litecoin", hasFullDetail: false, categories: [] });
    expect(body.meta.stale).toBe(true);
    // Coins outside the top list have nothing to fall back on.
    await request(ctx.app).get("/api/v1/coins/extra-unknown").expect(503);
  });

  it("returns 503 when there is no snapshot either", async () => {
    ctx.cg.state.fail = new UpstreamError(500);
    const res = await request(ctx.app).get("/api/v1/coins/bitcoin/chart?range=3m").expect(503);
    expect(res.body.error.code).toBe("UPSTREAM_UNAVAILABLE");
  });
});

describe("CoinGecko quota guard", () => {
  it("triples cache TTLs above 80% of the monthly budget", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      for (let i = 0; i < 8_001; i++) await ctx.cache.incr(usageKey(), 3600);
      await request(ctx.app).get("/api/v1/global").expect(200);
      vi.setSystemTime(Date.now() + (TTL.global + 5) * 1000);
      await request(ctx.app).get("/api/v1/global").expect(200);
      expect(ctx.cg.calls.filter((c) => c === "/global")).toHaveLength(1);
    } finally {
      vi.useRealTimers();
      await ctx.cache.del(usageKey());
    }
  });
});

describe("CoinGecko client", () => {
  const ok = (body: unknown, status = 200) =>
    vi.fn(async () => new Response(JSON.stringify(body), { status }));

  it("sends the demo key, query params and counts usage", async () => {
    const cache = new MemoryCache();
    const fetch = ok({ hello: 1 });
    const cg = createCoinGecko({ apiKey: "demo-123", cache, fetch });
    expect(await cg.get("/ping", { a: 1, b: true })).toEqual({ hello: 1 });
    const [url, init] = fetch.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe("https://api.coingecko.com/api/v3/ping?a=1&b=true");
    expect((init.headers as Record<string, string>)["x-cg-demo-api-key"]).toBe("demo-123");
    expect(await cache.get(usageKey())).toBe(1);
  });

  it("maps 404, rate limits and network errors", async () => {
    const cache = new MemoryCache();
    await expect(createCoinGecko({ cache, fetch: ok({}, 404) }).get("/x")).rejects.toMatchObject({
      status: 404,
    });
    await expect(createCoinGecko({ cache, fetch: ok({}, 429) }).get("/x")).rejects.toMatchObject({
      status: 503,
      upstreamStatus: 429,
    });
    const offline = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(createCoinGecko({ cache, fetch: offline }).get("/x")).rejects.toBeInstanceOf(
      UpstreamError,
    );
  });
});

describe("system routes", () => {
  it("health check, OpenAPI document and Swagger UI", async () => {
    const health = await request(ctx.app).get("/api/v1/health").expect(200);
    expect(health.body).toMatchObject({ status: "ok" });

    const doc = await request(ctx.app).get("/openapi.json").expect(200);
    expect(doc.body.openapi).toBe("3.1.0");
    expect(Object.keys(doc.body.paths)).toContain("/api/v1/ai/chat");

    const html = await request(ctx.app).get("/docs").expect(200);
    expect(html.text).toContain("swagger-ui-bundle.js");
    await request(ctx.app).get("/docs/init.js").expect(200);
    await request(ctx.app).get("/").expect(302);
  });

  it("returns JSON errors for unknown routes and bad JSON", async () => {
    const res = await request(ctx.app).get("/api/v1/nope").expect(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    const bad = await request(ctx.app)
      .post("/api/v1/auth/login")
      .set("content-type", "application/json")
      .send("{oops")
      .expect(400);
    expect(bad.body.error.message).toBe("Invalid JSON body");
  });
});
