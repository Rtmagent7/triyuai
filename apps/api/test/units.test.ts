import type { Redis } from "@upstash/redis";
import { describe, expect, it, vi } from "vitest";
import { MemoryCache, UpstashCache, createCache } from "../src/cache";
import { loadEnv } from "../src/env";

describe("MemoryCache", () => {
  it("expires values and returns copies", async () => {
    let now = 0;
    const cache = new MemoryCache(() => now);
    const value = { a: [1] };
    await cache.set("k", value, 10);
    value.a.push(2);
    const read = (await cache.get<{ a: number[] }>("k"))!;
    read.a.push(3);
    expect(await cache.get("k")).toEqual({ a: [1] });
    now = 10_000;
    expect(await cache.get("k")).toBeNull();
  });

  it("counts within a fixed window", async () => {
    let now = 0;
    const cache = new MemoryCache(() => now);
    expect(await cache.incr("c", 60)).toBe(1);
    now = 59_000;
    expect(await cache.incr("c", 60)).toBe(2); // the window does not slide
    now = 60_000;
    expect(await cache.incr("c", 60)).toBe(1);
  });
});

describe("UpstashCache", () => {
  it("maps calls to Redis commands and sets the TTL once per window", async () => {
    const redis = {
      get: vi.fn(async () => ({ x: 1 })),
      set: vi.fn(async () => "OK"),
      incr: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2),
      expire: vi.fn(async () => 1),
      del: vi.fn(async () => 1),
    };
    const cache = new UpstashCache(redis as unknown as Redis);
    expect(await cache.get("k")).toEqual({ x: 1 });
    await cache.set("k", { x: 1 }, 0.2);
    expect(redis.set).toHaveBeenCalledWith("k", { x: 1 }, { ex: 1 });
    await cache.incr("n", 60);
    await cache.incr("n", 60);
    expect(redis.expire).toHaveBeenCalledTimes(1);
    await cache.del("k");
    expect(redis.del).toHaveBeenCalledWith("k");
  });

  it("is used only when both Upstash variables are set", () => {
    expect(createCache()).toBeInstanceOf(MemoryCache);
    expect(createCache("https://x.upstash.io")).toBeInstanceOf(MemoryCache);
    expect(createCache("https://x.upstash.io", "token")).toBeInstanceOf(UpstashCache);
  });
});

describe("loadEnv", () => {
  it("has working development defaults", () => {
    expect(loadEnv({})).toMatchObject({
      PORT: 4000,
      DATABASE_URL: "pglite:./.pglite",
      GROQ_MODEL: "openai/gpt-oss-120b",
    });
  });

  it("refuses insecure defaults in production", () => {
    expect(() => loadEnv({ NODE_ENV: "production" })).toThrow(/JWT_SECRET/);
    expect(() => loadEnv({ NODE_ENV: "production", JWT_SECRET: "x".repeat(40) })).toThrow(
      /DATABASE_URL/,
    );
    expect(() =>
      loadEnv({
        NODE_ENV: "production",
        JWT_SECRET: "x".repeat(40),
        DATABASE_URL: "postgresql://db/x",
      }),
    ).not.toThrow();
    expect(() => loadEnv({ JWT_SECRET: "short" })).toThrow();
  });
});
