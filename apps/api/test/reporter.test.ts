import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { NotFoundError } from "../src/lib/errors";
import { createReporter, type ErrorReporter } from "../src/lib/reporter";
import { createTestContext, silentLogger } from "./helpers";

function fakeReporter() {
  const captured: { err: unknown; path: string }[] = [];
  let flushed = 0;
  const reporter: ErrorReporter = {
    capture: (err, ctx) => captured.push({ err, path: ctx.path }),
    flush: async () => {
      flushed++;
    },
  };
  return { reporter, captured, flushes: () => flushed };
}

describe("error reporting", () => {
  it("reports unexpected errors (and sends them before answering 500)", async () => {
    const ctx = await createTestContext();
    const fake = fakeReporter();
    const boom = new Error("database on fire");
    const app = createApp({
      ...ctx.deps,
      reporter: fake.reporter,
      market: { ...ctx.deps.market, global: async () => Promise.reject(boom) },
    });
    const res = await request(app).get("/api/v1/global").expect(500);
    expect(res.body.error.code).toBe("INTERNAL");
    expect(fake.captured).toEqual([{ err: boom, path: "/api/v1/global" }]);
    expect(fake.flushes()).toBe(1);
  });

  it("leaves expected errors (4xx) out", async () => {
    const ctx = await createTestContext();
    const fake = fakeReporter();
    const app = createApp({
      ...ctx.deps,
      reporter: fake.reporter,
      market: { ...ctx.deps.market, global: async () => Promise.reject(new NotFoundError("Coin")) },
    });
    await request(app).get("/api/v1/global").expect(404);
    await request(app)
      .post("/api/v1/auth/login")
      .set("content-type", "application/json")
      .send("{bad")
      .expect(400);
    expect(fake.captured).toEqual([]);
  });

  it("does nothing without a DSN", async () => {
    const reporter = await createReporter({ environment: "test", logger: silentLogger });
    reporter.capture(new Error("x"), { method: "GET", path: "/" });
    await expect(reporter.flush()).resolves.toBeUndefined();
  });
});
