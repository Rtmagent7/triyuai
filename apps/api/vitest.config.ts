import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // Each file boots its own in-memory Postgres (PGlite); argon2 hashing is CPU-bound.
    testTimeout: 20_000,
    hookTimeout: 30_000,
    env: { TZ: "UTC" },
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "text", "lcov"],
      include: ["src/**"],
      exclude: ["src/generated/**", "src/server.ts", "src/deps.ts", "src/types.d.ts"],
      thresholds: { statements: 80, branches: 75, functions: 80, lines: 80 },
    },
  },
});
