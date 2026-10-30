import request from "supertest";
import { describe, expect, it } from "vitest";
import { transactionSchema } from "@triyuai/shared/portfolio";
import { z } from "zod";
import { createDb } from "../src/db";
import { createTestContext } from "./helpers";

async function signedIn(email = `p${Math.random()}@example.com`) {
  const ctx = await createTestContext({ db: await createDb("pglite:memory") });
  const agent = request.agent(ctx.app);
  await agent
    .post("/api/v1/auth/register")
    .send({ name: "P", email, password: "Sup3rsecret" })
    .expect(201);
  return { ctx, agent };
}

const buy = (over: object = {}) => ({
  coinId: "bitcoin",
  type: "buy",
  quantity: 0.5,
  priceUsd: 60_000,
  date: "2026-06-01T00:00:00.000Z",
  ...over,
});
const URL = "/api/v1/portfolio/transactions";

describe("portfolio", () => {
  it("records buys and sells and lists them newest first", async () => {
    const { agent } = await signedIn();
    await agent.post(URL).send(buy()).expect(201);
    const res = await agent
      .post(URL)
      .send(
        buy({
          type: "sell",
          quantity: 0.2,
          priceUsd: 70_000,
          date: "2026-07-01T00:00:00Z",
          note: "trim",
        }),
      )
      .expect(201);
    expect(() => z.array(transactionSchema).parse(res.body.data)).not.toThrow();
    expect(res.body.data.map((t: { type: string }) => t.type)).toEqual(["sell", "buy"]);
    expect(res.body.data[0]).toMatchObject({ quantity: 0.2, priceUsd: 70_000, note: "trim" });
  });

  it("refuses to sell more than was held on that date", async () => {
    const { agent } = await signedIn();
    await agent
      .post(URL)
      .send(buy({ quantity: 1 }))
      .expect(201);
    const over = await agent
      .post(URL)
      .send(buy({ type: "sell", quantity: 2, date: "2026-07-01T00:00:00Z" }))
      .expect(422);
    expect(over.body.error.code).toBe("INSUFFICIENT_HOLDINGS");
    // Back-dated before the buy: nothing was held yet.
    const early = await agent
      .post(URL)
      .send(buy({ type: "sell", quantity: 0.1, date: "2026-05-01T00:00:00+07:00" }))
      .expect(422);
    expect(early.body.error.message).toContain("didn't hold");
    await agent
      .post(URL)
      .send(buy({ type: "sell", quantity: 1, date: "2026-07-01T00:00:00Z" }))
      .expect(201);
  });

  it("validates input", async () => {
    const { agent } = await signedIn();
    await agent
      .post(URL)
      .send(buy({ quantity: 0 }))
      .expect(400);
    await agent
      .post(URL)
      .send(buy({ priceUsd: -5 }))
      .expect(400);
    await agent
      .post(URL)
      .send(buy({ coinId: "Not A Coin" }))
      .expect(400);
    await agent
      .post(URL)
      .send(buy({ date: "2999-01-01T00:00:00Z" }))
      .expect(400);
  });

  it("keeps each account's portfolio private, deletes, and requires sign-in", async () => {
    const { ctx, agent } = await signedIn();
    const id = (await agent.post(URL).send(buy()).expect(201)).body.data[0].id;

    const other = request.agent(ctx.app);
    await other
      .post("/api/v1/auth/register")
      .send({ name: "O", email: "other-p@example.com", password: "Sup3rsecret" })
      .expect(201);
    expect((await other.get(URL).expect(200)).body.data).toEqual([]);
    await other.delete(`${URL}/${id}`).expect(404);

    await request(ctx.app).get(URL).expect(401);
    expect((await agent.delete(`${URL}/${id}`).expect(200)).body.data).toEqual([]);
  });
});
