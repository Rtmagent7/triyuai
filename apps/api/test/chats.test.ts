import request from "supertest";
import { describe, expect, it } from "vitest";
import { chatThreadSchema } from "@triyuai/shared";
import { createDb } from "../src/db";
import { MAX_CONVERSATIONS, titleFrom } from "../src/services/chats";
import { createTestContext, mockModel, sseEvents, type Step } from "./helpers";

const ask = (content: string, extra: object = {}) => ({
  messages: [{ role: "user", content }],
  ...extra,
});

/** A model that answers every request with the same steps. */
async function setup(steps: Step[]) {
  const model = mockModel(Array.from({ length: 40 }, () => steps).flat());
  const ctx = await createTestContext({
    models: [{ name: "m", model }],
    db: await createDb("pglite:memory"),
  });
  const agent = request.agent(ctx.app);
  await agent
    .post("/api/v1/auth/register")
    .send({ name: "H", email: `h${Math.random()}@example.com`, password: "Sup3rsecret" })
    .expect(201);
  return { ctx, agent };
}

const answer = [
  { tools: [{ name: "getCoinDetails", input: { coinId: "solana" } }] },
  { text: "Solana is up." },
];

describe("chat history", () => {
  it("saves a signed-in user's exchange and continues the same conversation", async () => {
    const { agent } = await setup(answer);
    const first = await agent.post("/api/v1/ai/chat").send(ask("How is SOL?")).expect(200);
    const events = sseEvents(first.text);
    expect(events[0]).toMatchObject({ type: "conversation" });
    const id = String(events[0]?.id);

    await agent
      .post("/api/v1/ai/chat")
      .send({
        messages: [
          { role: "user", content: "How is SOL?" },
          { role: "assistant", content: "Solana is up." },
          { role: "user", content: "And ETH?" },
        ],
        conversationId: id,
      })
      .expect(200);

    const list = await agent.get("/api/v1/chats").expect(200);
    expect(list.body.data).toEqual([expect.objectContaining({ id, title: "How is SOL?" })]);
    const thread = await agent.get(`/api/v1/chats/${id}`).expect(200);
    expect(() => chatThreadSchema.parse(thread.body.data)).not.toThrow();
    expect(
      thread.body.data.messages.map((m: { role: string; content: string }) => m.content),
    ).toEqual(["How is SOL?", "Solana is up.", "And ETH?", "Solana is up."]);
    expect(thread.body.data.messages[1].tools).toEqual(["Fetched: Solana price"]);
  });

  it("replaces the last answer on regenerate", async () => {
    const { agent } = await setup([{ text: "Again." }]);
    const first = await agent.post("/api/v1/ai/chat").send(ask("hi")).expect(200);
    const id = String(sseEvents(first.text)[0]?.id);
    await agent
      .post("/api/v1/ai/chat")
      .send({ ...ask("hi"), conversationId: id, regenerate: true })
      .expect(200);
    const thread = await agent.get(`/api/v1/chats/${id}`).expect(200);
    expect(thread.body.data.messages.map((m: { role: string }) => m.role)).toEqual([
      "user",
      "assistant",
    ]);
  });

  it("keeps conversations private and deletable", async () => {
    const { ctx, agent } = await setup([{ text: "ok" }]);
    const first = await agent.post("/api/v1/ai/chat").send(ask("mine")).expect(200);
    const id = String(sseEvents(first.text)[0]?.id);

    const other = request.agent(ctx.app);
    await other
      .post("/api/v1/auth/register")
      .send({ name: "O", email: "other@example.com", password: "Sup3rsecret" })
      .expect(201);
    await other.get(`/api/v1/chats/${id}`).expect(404);
    await other.delete(`/api/v1/chats/${id}`).expect(404);
    // Someone else's id starts a new conversation instead of writing into theirs.
    const hijack = await other
      .post("/api/v1/ai/chat")
      .send({ ...ask("sneaky"), conversationId: id })
      .expect(200);
    expect(sseEvents(hijack.text)[0]).not.toEqual({ type: "conversation", id });

    await request(ctx.app).get("/api/v1/chats").expect(401);
    await agent.delete(`/api/v1/chats/${id}`).expect(204);
    expect((await agent.get("/api/v1/chats").expect(200)).body.data).toEqual([]);
  });

  it("does not save guest chats", async () => {
    const ctx = await createTestContext({
      models: [{ name: "m", model: mockModel([{ text: "hello" }]) }],
      db: await createDb("pglite:memory"),
    });
    const res = await request(ctx.app).post("/api/v1/ai/chat").send(ask("hi")).expect(200);
    expect(sseEvents(res.text).some((e) => e.type === "conversation")).toBe(false);
  });

  it("keeps the newest conversations up to the cap", async () => {
    const { ctx, agent } = await setup([{ text: "ok" }]);
    for (let i = 0; i <= MAX_CONVERSATIONS; i++)
      await ctx.deps.history.open(
        (await agent.get("/api/v1/auth/me").expect(200)).body.data.id,
        undefined,
        `q${i}`,
      );
    const list = (await agent.get("/api/v1/chats").expect(200)).body.data;
    expect(list).toHaveLength(MAX_CONVERSATIONS);
    expect(list.some((c: { title: string }) => c.title === "q0")).toBe(false);
  });
});

describe("titleFrom", () => {
  it("uses the first question on one line, shortened", () => {
    expect(titleFrom("  How is\nSolana  doing? ")).toBe("How is Solana doing?");
    expect(titleFrom("x".repeat(80))).toHaveLength(58);
    expect(titleFrom("   ")).toBe("New chat");
  });
});
