import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
// Locally we can reuse the installed Chrome instead of downloading Playwright's Chromium.
const channel = process.env.E2E_CHANNEL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 2,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    colorScheme: "dark",
    locale: "en-US",
    timezoneId: "Asia/Jakarta",
    ...(channel ? { channel } : {}),
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        ...(channel ? { channel } : {}),
      },
      testIgnore: /mobile.spec.ts/,
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], ...(channel ? { channel } : {}) },
      testMatch: /mobile\.spec\.ts/,
    },
  ],
  // Tests run against a production build (`pnpm build` first), like the deployed site.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm exec next start -p ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
