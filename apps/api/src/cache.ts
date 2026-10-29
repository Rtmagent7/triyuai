import { Redis } from "@upstash/redis";

/**
 * Key-value store for CoinGecko responses, rate limits and chat quotas.
 * Vercel Functions keep no memory between requests, so production uses Upstash
 * Redis; the in-memory version is for local development and tests.
 */
export interface Cache {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  /** Increments a counter; the TTL is set when the key is created (fixed window). */
  incr(key: string, ttlSeconds: number): Promise<number>;
  del(key: string): Promise<void>;
}

export class MemoryCache implements Cache {
  private store = new Map<string, { value: unknown; expiresAt: number }>();

  constructor(private now: () => number = Date.now) {}

  private live(key: string) {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= this.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit;
  }

  async get<T>(key: string) {
    // Values are cloned so callers cannot mutate the cached copy (same as Redis).
    const hit = this.live(key);
    return hit ? (structuredClone(hit.value) as T) : null;
  }

  async set(key: string, value: unknown, ttlSeconds: number) {
    this.store.set(key, { value: structuredClone(value), expiresAt: this.now() + ttlSeconds * 1000 });
  }

  async incr(key: string, ttlSeconds: number) {
    const hit = this.live(key);
    const value = (hit ? (hit.value as number) : 0) + 1;
    this.store.set(key, { value, expiresAt: hit?.expiresAt ?? this.now() + ttlSeconds * 1000 });
    return value;
  }

  async del(key: string) {
    this.store.delete(key);
  }
}

export class UpstashCache implements Cache {
  constructor(private redis: Redis) {}

  get<T>(key: string) {
    return this.redis.get<T>(key);
  }

  async set(key: string, value: unknown, ttlSeconds: number) {
    await this.redis.set(key, value, { ex: Math.max(1, Math.round(ttlSeconds)) });
  }

  async incr(key: string, ttlSeconds: number) {
    const value = await this.redis.incr(key);
    if (value === 1) await this.redis.expire(key, ttlSeconds);
    return value;
  }

  async del(key: string) {
    await this.redis.del(key);
  }
}

export function createCache(url?: string, token?: string): Cache {
  return url && token ? new UpstashCache(new Redis({ url, token })) : new MemoryCache();
}
