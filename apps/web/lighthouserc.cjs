/**
 * Lighthouse CI (PRD §5): mobile scores on the home and coin detail pages.
 * Performance is a warning because shared CI runners are noisy; the other
 * categories are hard gates.
 */
module.exports = {
  ci: {
    collect: {
      startServerCommand: "pnpm exec next start -p 3200",
      startServerReadyPattern: "Ready in",
      url: ["http://localhost:3200/", "http://localhost:3200/coins/bitcoin"],
      numberOfRuns: 3,
      settings: {
        // Live prices come from a third-party WebSocket; keep runs deterministic.
        blockedUrlPatterns: ["*binance*"],
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.9 }],
        "categories:accessibility": ["error", { minScore: 0.95 }],
        "categories:best-practices": ["error", { minScore: 0.95 }],
        "categories:seo": ["error", { minScore: 0.95 }],
        "largest-contentful-paint": ["warn", { maxNumericValue: 2500 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
      },
    },
    upload: {
      // Reports stay in the CI artifacts; nothing is published to public storage.
      target: "filesystem",
      outputDir: "./lhci-report",
    },
  },
};
