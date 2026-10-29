import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
    // Form tests type character by character; leave headroom when suites run in parallel.
    testTimeout: 15_000,
    env: {
      // Tests talk to MSW's Node server instead of the browser service worker.
      NEXT_PUBLIC_API_MOCKING: "disabled",
      NEXT_PUBLIC_API_URL: "http://localhost/api/v1",
      TZ: "UTC",
    },
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "text", "html", "lcov"],
      // PRD §5: ≥ 80% for utils, hooks and components. CI fails below this.
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
      include: [
        "src/lib/**",
        "src/hooks/**",
        "src/stores/**",
        "src/components/**",
        "src/mocks/*.ts",
      ],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/test/**",
        "src/mocks/browser.ts",
        "src/lib/api/server.ts",
        // Canvas chart and the lazy wrapper are covered by Playwright (e2e/), not jsdom.
        "src/components/coin/price-chart.tsx",
        "src/components/coin/price-chart-lazy.tsx",
        "src/components/trading/chart-engine.ts",
        "src/components/trading/drawings-primitive.ts",
        "src/components/trading/trading-chart.tsx",
        "src/components/trading/trading-chart-lazy.tsx",
      ],
    },
  },
});
