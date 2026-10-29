import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "../src/db";
import { createTestContext } from "./helpers";

/**
 * Runs the account flow against a real Postgres (CI service container) through the
 * production pg adapter, after `prisma migrate deploy`. Skipped when no URL is given.
 */
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("real Postgres", () => {
  let db: Db;
  afterAll(() => db?.$disconnect());

  it("registers, syncs a watchlist, rotates the session and stores snapshots", async () => {
    db = await createDb(url!);
    const ctx = await createTestContext({ db });
    const agent = request.agent(ctx.app);
    const email = `pg-${Date.now()}@example.com`;

    await agent
      .post("/api/v1/auth/register")
      .send({ name: "PG", email, password: "Sup3rsecret" })
      .expect(201);
    await agent
      .post("/api/v1/watchlist/merge")
      .send({ coinIds: ["bitcoin", "solana", "bitcoin"] })
      .expect(200);
    await agent.post("/api/v1/auth/refresh").expect(200);
    const me = await agent.get("/api/v1/auth/me").expect(200);
    expect(me.body.data).toMatchObject({ email, watchlist: ["bitcoin", "solana"] });

    await request(ctx.app).get("/api/v1/global").expect(200);
    const snap = await db.marketSnapshot.findUnique({ where: { key: "cg:global" } });
    expect(snap?.payload).toMatchObject({ activeCoins: 15000 });
  });
});
