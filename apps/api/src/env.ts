import { z } from "zod";

/** Backend configuration. Every external service is optional in development (see README). */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  LOG_LEVEL: z.string().default("info"),
  /** Frontend origin allowed by CORS (the web app normally proxies /api/v1, so this is a fallback). */
  WEB_ORIGIN: z.string().default("http://localhost:3000"),

  /** Postgres URL (Neon), or `pglite:<dir>` for an embedded database in local development. */
  DATABASE_URL: z.string().default("pglite:./.pglite"),
  /** Upstash Redis REST credentials. Without them an in-memory cache is used (single instance only). */
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  /** CoinGecko Demo API key. Without it the keyless public API is used (lower, shared rate limit). */
  COINGECKO_API_KEY: z.string().optional(),
  COINGECKO_MONTHLY_BUDGET: z.coerce.number().default(10_000),

  JWT_SECRET: z.string().min(32).default("dev-only-secret-change-me-0123456789abcdef"),
  /** Salt for hashing guest IPs before they are used as quota keys. */
  IP_HASH_SALT: z.string().default("dev-salt"),

  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default("openai/gpt-oss-120b"),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const env = envSchema.parse(source);
  if (env.NODE_ENV === "production") {
    if (env.JWT_SECRET.startsWith("dev-only")) throw new Error("JWT_SECRET must be set in production");
    if (env.DATABASE_URL.startsWith("pglite:")) throw new Error("DATABASE_URL must be set in production");
  }
  return env;
}
