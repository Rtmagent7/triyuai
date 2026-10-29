import request from "supertest";
import type { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { chatStreamEventSchema, GUEST_DAILY_CHAT_QUOTA, USER_DAILY_CHAT_QUOTA } from "@triyuai/shared";
import { createDb } from "../src/db";
import { createTestContext, mockModel, sseEvents, type Step } from "./helpers";

const ask = (content: string, extra: object = {}) => ({ messages: [{ role: "user", content }], ...extra });

async function setup(steps: Step[][], opts: { failFirst?: "before" | "during" } = {}) {
  const models = steps.map((s, i) => ({ name: `model${i}`, model: mockModel(s) }));
  if (opts.failFirst === "before") {
    models.unshift({
      name: "broken",
      model: mockModel(() => {
        throw new Error("429 from provider");
      }),
    });
  }
  return createTestContext({ models, db: await createDb("pglite:memory") });
}

describe("POST /ai/chat", () => {
  it("streams tool chips, text and finish as SSE following the contract", async () => {
    const ctx = await setup([
      [
        { tools: [{ name: "getCoinDetails", input: { coinId: "solana" } }] },
        { text: "**Solana (SOL)** is trading at $333.33. _Not financial advice._" },
      ],
    ]);
    const res = await request(ctx.app).post("/api/v1/ai/chat").send(ask("How is SOL?")).expect(200);
    expect(res.headers["content-type"]).toContain("text/event-stream");
    expect(res.headers["x-quota-limit"]).toBe(String(GUEST_DAILY_CHAT_QUOTA));
    expect(res.headers["x-quota-remaining"]).toBe(String(GUEST_DAILY_CHAT_QUOTA - 1));

    const events = sseEvents(res.text);
    for (const e of events) expect(() => chatStreamEventSchema.parse(e)).not.toThrow();
    expect(events[0]).toEqual({ type: "tool-call", id: "call_0_0", name: "getCoinDetails", label: "Fetched: Solana price" });
    expect(events[1]).toEqual({ type: "tool-result", id: "call_0_0" });
    const text = events.filter((e) => e.type === "text-delta").map((e) => e.delta).join("");
    expect(text).toBe("**Solana (SOL)** is trading at $333.33. _Not financial advice._");
    expect(events.at(-1)).toMatchObject({ type: "finish" });
  });

  it("gives the model real tool data and the coin page context", async () => {
    const model = mockModel([
      {
        tools: [
          { name: "compareCoins", input: { coinIds: ["bitcoin", "ethereum"] } },
          { name: "getTopMovers", input: { direction: "losers", limit: 2 } },
        ],
      },
      { text: "Done." },
    ]) as MockLanguageModelV4;
    const ctx = await createTestContext({ models: [{ name: "m", model }], db: await createDb("pglite:memory") });
    const res = await request(ctx.app)
      .post("/api/v1/ai/chat")
      .send(ask("compare it with ETH", { context: { coinId: "bitcoin" } }))
      .expect(200);
    const labels = sseEvents(res.text).filter((e) => e.type === "tool-call").map((e) => e.label);
    expect(labels).toEqual(["Fetched: BIT vs ETH data", "Fetched: top losers"]);

    const [first, second] = model.doStreamCalls;
    expect(JSON.stringify(first!.prompt[0])).toContain("The user is on the Bitcoin page (id: bitcoin)");
    // Step 2 sees the tool outputs, built from live market data rather than model memory.
    const toolMessages = JSON.stringify(second!.prompt.filter((m) => m.role === "tool"));
    expect(toolMessages).toContain('"priceUsd":1000');
    expect(toolMessages).toContain('"id":"ethereum"');
  });

  it("covers every tool and its chip label", async () => {
    const ctx = await setup([
      [
        {
          tools: [
            { name: "getMarketOverview", input: {} },
            { name: "searchCoin", input: { query: "sol" } },
            { name: "getTopMovers", input: { direction: "gainers" } },
            { name: "getCoinDetails", input: { coinId: "missing-coin" } },
          ],
        },
        { text: "ok" },
      ],
    ]);
    const res = await request(ctx.app).post("/api/v1/ai/chat").send(ask("market?")).expect(200);
    const events = sseEvents(res.text);
    expect(events.filter((e) => e.type === "tool-call").map((e) => e.label)).toEqual([
      "Fetched: market overview",
      'Searched: "sol"',
      "Fetched: top gainers",
      "Fetched: missing-coin price",
    ]);
    expect(events.filter((e) => e.type === "tool-result")).toHaveLength(4);
  });

  it("falls back to the next model when the first fails before streaming", async () => {
    const ctx = await setup([[{ text: "Answer from the fallback model." }]], { failFirst: "before" });
    const res = await request(ctx.app).post("/api/v1/ai/chat").send(ask("hi")).expect(200);
    const events = sseEvents(res.text);
    expect(events.map((e) => e.type)).toEqual(["text-delta", "text-delta", "text-delta", "text-delta", "text-delta", "finish"]);
  });

  it("emits an error event when every model fails", async () => {
    const ctx = await setup([], { failFirst: "before" });
    const res = await request(ctx.app).post("/api/v1/ai/chat").send(ask("hi")).expect(200);
    expect(sseEvents(res.text)).toEqual([
      { type: "error", code: "AI_FAILED", message: "Ask TRIYU couldn't finish this answer. Please try again." },
    ]);
  });

  it("validates the request", async () => {
    const ctx = await setup([[{ text: "x" }]]);
    await request(ctx.app).post("/api/v1/ai/chat").send({ messages: [] }).expect(400);
    await request(ctx.app)
      .post("/api/v1/ai/chat")
      .send(ask("x".repeat(2001)))
      .expect(400);
  });

  it("returns 503 when no AI provider is configured", async () => {
    const ctx = await createTestContext();
    const res = await request(ctx.app).post("/api/v1/ai/chat").send(ask("hi")).expect(503);
    expect(res.body.error.code).toBe("AI_UNAVAILABLE");
  });

  it("enforces 10 messages a day for guests and 30 for signed-in users", async () => {
    const ctx = await setup([Array.from({ length: 50 }, () => ({ text: "ok" }))]);
    const guest = "198.51.100.7";
    for (let i = 0; i < GUEST_DAILY_CHAT_QUOTA; i++) {
      await request(ctx.app).post("/api/v1/ai/chat").set("X-Forwarded-For", guest).send(ask("hi")).expect(200);
    }
    const over = await request(ctx.app).post("/api/v1/ai/chat").set("X-Forwarded-For", guest).send(ask("hi")).expect(429);
    expect(over.body.error).toMatchObject({ code: "QUOTA_EXCEEDED" });
    expect(over.body.error.message).toContain("Sign in to get 30 messages a day");

    // Signing in from the same IP gets the account's own, larger quota.
    const agent = request.agent(ctx.app);
    await agent
      .post("/api/v1/auth/register")
      .set("X-Forwarded-For", guest)
      .send({ name: "Q", email: "quota@example.com", password: "Sup3rsecret" })
      .expect(201);
    const res = await agent.post("/api/v1/ai/chat").set("X-Forwarded-For", guest).send(ask("hi")).expect(200);
    expect(res.headers["x-quota-limit"]).toBe(String(USER_DAILY_CHAT_QUOTA));
    expect(res.headers["x-quota-remaining"]).toBe(String(USER_DAILY_CHAT_QUOTA - 1));
  });
});
