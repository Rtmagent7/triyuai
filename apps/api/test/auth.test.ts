import request from "supertest";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { apiResponse, userSchema } from "@triyuai/shared";
import { DEMO_EMAIL, DEMO_WATCHLIST } from "../src/services/auth";
import { createTestContext, type TestContext } from "./helpers";

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestContext();
});

let n = 0;
const newUser = () => ({ name: "Rekha", email: `user${++n}@example.com`, password: "Sup3rsecret" });

const cookieNames = (res: request.Response) =>
  ([] as string[]).concat(res.headers["set-cookie"] ?? []).map((c) => c.split("=")[0]);
const cookie = (res: request.Response, name: string) =>
  ([] as string[]).concat(res.headers["set-cookie"] ?? []).find((c) => c.startsWith(`${name}=`))!;

describe("register & login", () => {
  it("registers, sets httpOnly cookies and returns the user", async () => {
    const res = await request(ctx.app).post("/api/v1/auth/register").send(newUser()).expect(201);
    expect(() => apiResponse(userSchema).parse(res.body)).not.toThrow();
    expect(res.body.data).toMatchObject({ name: "Rekha", isDemo: false });
    expect(res.body.data).not.toHaveProperty("passwordHash");
    expect(cookieNames(res)).toEqual(["triyu_at", "triyu_rt", "triyu_session"]);
    expect(cookie(res, "triyu_session")).not.toMatch(/HttpOnly/);
    expect(cookie(res, "triyu_at")).toMatch(/HttpOnly/);
    expect(cookie(res, "triyu_at")).toMatch(/SameSite=Lax/);
    expect(cookie(res, "triyu_rt")).toMatch(/Path=\/api\/v1\/auth/);
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("stores an argon2 hash, never the password", async () => {
    const u = newUser();
    await request(ctx.app).post("/api/v1/auth/register").send(u).expect(201);
    const row = await ctx.db.user.findUniqueOrThrow({ where: { email: u.email } });
    expect(row.passwordHash).toMatch(/^\$argon2id\$/);
    expect(row.passwordHash).not.toContain(u.password);
  });

  it("validates input and password strength", async () => {
    const weak = await request(ctx.app)
      .post("/api/v1/auth/register")
      .send({ ...newUser(), password: "alllowercase1" })
      .expect(400);
    expect(weak.body.error.message).toBe("Add an uppercase letter");
    const email = await request(ctx.app)
      .post("/api/v1/auth/register")
      .send({ ...newUser(), email: "nope" })
      .expect(400);
    expect(email.body.error.message).toBe("Enter a valid email");
  });

  it("rejects duplicate emails case-insensitively", async () => {
    const u = newUser();
    await request(ctx.app).post("/api/v1/auth/register").send(u).expect(201);
    const res = await request(ctx.app)
      .post("/api/v1/auth/register")
      .send({ ...u, email: u.email.toUpperCase() })
      .expect(409);
    expect(res.body.error.code).toBe("EMAIL_TAKEN");
    await request(ctx.app)
      .post("/api/v1/auth/register")
      .send({ ...newUser(), email: DEMO_EMAIL })
      .expect(409);
  });

  it("logs in with the right password only, with one generic error", async () => {
    const u = newUser();
    await request(ctx.app).post("/api/v1/auth/register").send(u).expect(201);
    const ok = await request(ctx.app)
      .post("/api/v1/auth/login")
      .send({ email: u.email.toUpperCase(), password: u.password })
      .expect(200);
    expect(ok.body.data.email).toBe(u.email);

    const wrong = await request(ctx.app)
      .post("/api/v1/auth/login")
      .send({ ...u, password: "Wrong1234" })
      .expect(401);
    const unknown = await request(ctx.app)
      .post("/api/v1/auth/login")
      .send({ email: "ghost@example.com", password: "Whatever1" })
      .expect(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it("limits password guessing per IP and email", async () => {
    const u = newUser();
    await request(ctx.app).post("/api/v1/auth/register").send(u).expect(201);
    for (let i = 0; i < 10; i++) {
      await request(ctx.app)
        .post("/api/v1/auth/login")
        .send({ ...u, password: "Wrong1234" })
        .expect(401);
    }
    const res = await request(ctx.app).post("/api/v1/auth/login").send(u).expect(429);
    expect(res.body.error.code).toBe("TOO_MANY_ATTEMPTS");
  });
});

describe("session", () => {
  it("me requires a valid access token", async () => {
    await request(ctx.app).get("/api/v1/auth/me").expect(401);
    await request(ctx.app)
      .get("/api/v1/auth/me")
      .set("Cookie", "triyu_at=forged.token.value")
      .expect(401);

    const agent = request.agent(ctx.app);
    await agent.post("/api/v1/auth/register").send(newUser()).expect(201);
    const me = await agent.get("/api/v1/auth/me").expect(200);
    expect(me.body.data).toMatchObject({ name: "Rekha", watchlist: [] });
  });

  it("rotates refresh tokens and detects reuse of an old one", async () => {
    const res = await request(ctx.app).post("/api/v1/auth/register").send(newUser()).expect(201);
    const first = cookie(res, "triyu_rt").split(";")[0]!;

    const rotated = await request(ctx.app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", first)
      .expect(200);
    const second = cookie(rotated, "triyu_rt").split(";")[0]!;
    expect(second).not.toBe(first);

    // Replaying the first token revokes the whole family, including the newest token.
    await request(ctx.app).post("/api/v1/auth/refresh").set("Cookie", first).expect(401);
    const after = await request(ctx.app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", second)
      .expect(401);
    expect(cookieNames(after)).toEqual(["triyu_at", "triyu_rt", "triyu_session"]); // cleared
  });

  it("rejects missing, unknown and expired refresh tokens", async () => {
    await request(ctx.app).post("/api/v1/auth/refresh").expect(401);
    await request(ctx.app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", "triyu_rt=unknown")
      .expect(401);

    const res = await request(ctx.app).post("/api/v1/auth/register").send(newUser()).expect(201);
    await ctx.db.refreshToken.updateMany({
      where: { user: { email: res.body.data.email } },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await request(ctx.app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", cookie(res, "triyu_rt").split(";")[0]!)
      .expect(401);
  });

  it("logout revokes the refresh token", async () => {
    const agent = request.agent(ctx.app);
    const res = await agent.post("/api/v1/auth/register").send(newUser()).expect(201);
    const rt = cookie(res, "triyu_rt").split(";")[0]!;
    await agent.post("/api/v1/auth/logout").expect(204);
    await request(ctx.app).post("/api/v1/auth/refresh").set("Cookie", rt).expect(401);
    await request(ctx.app).post("/api/v1/auth/logout").expect(204);
  });
});

describe("demo account", () => {
  it("signs in to a seeded demo user with a preset watchlist, reset daily", async () => {
    const agent = request.agent(ctx.app);
    const res = await agent.post("/api/v1/auth/demo").expect(200);
    expect(res.body.data).toMatchObject({ email: DEMO_EMAIL, isDemo: true });
    expect((await agent.get("/api/v1/watchlist").expect(200)).body.data).toEqual(DEMO_WATCHLIST);

    // Changes survive until the next daily reset.
    await agent.delete("/api/v1/watchlist/bitcoin").expect(200);
    await request(ctx.app).post("/api/v1/auth/demo").expect(200);
    expect((await agent.get("/api/v1/watchlist").expect(200)).body.data).not.toContain("bitcoin");

    await ctx.cache.del(`demo:reset:${new Date().toISOString().slice(0, 10)}`);
    await request(ctx.app).post("/api/v1/auth/demo").expect(200);
    expect((await agent.get("/api/v1/watchlist").expect(200)).body.data).toEqual(DEMO_WATCHLIST);
  });

  it("cannot be entered with a password", async () => {
    await request(ctx.app).post("/api/v1/auth/demo").expect(200);
    await request(ctx.app)
      .post("/api/v1/auth/login")
      .send({ email: DEMO_EMAIL, password: "Anything1" })
      .expect(401);
  });
});

describe("watchlist", () => {
  it("requires sign-in", async () => {
    await request(ctx.app).get("/api/v1/watchlist").expect(401);
    await request(ctx.app).post("/api/v1/watchlist").send({ coinId: "bitcoin" }).expect(401);
  });

  it("adds, lists in order, ignores duplicates and removes", async () => {
    const agent = request.agent(ctx.app);
    await agent.post("/api/v1/auth/register").send(newUser()).expect(201);
    await agent.post("/api/v1/watchlist").send({ coinId: "solana" }).expect(201);
    await agent.post("/api/v1/watchlist").send({ coinId: "bitcoin" }).expect(201);
    const dup = await agent.post("/api/v1/watchlist").send({ coinId: "solana" }).expect(201);
    expect(dup.body.data).toEqual(["solana", "bitcoin"]);
    const del = await agent.delete("/api/v1/watchlist/solana").expect(200);
    expect(del.body.data).toEqual(["bitcoin"]);
    await agent.post("/api/v1/watchlist").send({ coinId: "Bad Id" }).expect(400);
  });

  it("merges the local watchlist on first login without duplicates", async () => {
    const agent = request.agent(ctx.app);
    await agent.post("/api/v1/auth/register").send(newUser()).expect(201);
    await agent.post("/api/v1/watchlist").send({ coinId: "ethereum" }).expect(201);
    const res = await agent
      .post("/api/v1/watchlist/merge")
      .send({ coinIds: ["bitcoin", "ethereum", "bitcoin", "solana"] })
      .expect(200);
    expect(res.body.data).toEqual(["ethereum", "bitcoin", "solana"]);
  });

  it("keeps watchlists per user", async () => {
    const a = request.agent(ctx.app);
    const b = request.agent(ctx.app);
    await a.post("/api/v1/auth/register").send(newUser()).expect(201);
    await b.post("/api/v1/auth/register").send(newUser()).expect(201);
    await a.post("/api/v1/watchlist").send({ coinId: "tron" }).expect(201);
    expect((await b.get("/api/v1/watchlist").expect(200)).body.data).toEqual([]);
  });

  it("caps the watchlist at 100 coins; merge truncates instead of failing", async () => {
    const agent = request.agent(ctx.app);
    await agent.post("/api/v1/auth/register").send(newUser()).expect(201);
    const ids = Array.from({ length: 100 }, (_, i) => `coin-${i}`);
    await agent.post("/api/v1/watchlist/merge").send({ coinIds: ids }).expect(200);
    const full = await agent.post("/api/v1/watchlist").send({ coinId: "one-more" }).expect(422);
    expect(full.body.error.code).toBe("WATCHLIST_FULL");
    const merged = await agent
      .post("/api/v1/watchlist/merge")
      .send({ coinIds: ["one-more"] })
      .expect(200);
    expect(merged.body.data).toHaveLength(100);
  });
});

describe("rate limiting", () => {
  it("allows 120 requests per minute per client, then 429", async () => {
    // Pin the clock mid-window so a slow run cannot cross into the next minute.
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-01-01T00:00:10Z") });
    try {
      const ip = "203.0.113.9";
      let last!: request.Response;
      for (let i = 0; i < 121; i++) {
        last = await request(ctx.app).get("/api/v1/rates").set("X-Forwarded-For", ip);
      }
      expect(last.status).toBe(429);
      expect(last.body.error.code).toBe("RATE_LIMITED");
      expect(last.headers["retry-after"]).toBe("50");
      // Other clients are unaffected.
      await request(ctx.app).get("/api/v1/rates").set("X-Forwarded-For", "203.0.113.10").expect(200);
    } finally {
      vi.useRealTimers();
    }
  });

  it("exempts server-rendered requests that carry the internal key", async () => {
    const internal = await createTestContext({ internalKey: "internal-key-0123456789" });
    for (let i = 0; i < 125; i++) {
      await request(internal.app)
        .get("/api/v1/rates")
        .set("x-internal-key", "internal-key-0123456789")
        .expect(200);
    }
    await request(internal.app).get("/api/v1/rates").set("x-internal-key", "wrong").expect(200);
  });
});
