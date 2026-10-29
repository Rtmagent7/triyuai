import { chromium, devices } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome" });
for (const path of ["/coins/bitcoin", "/"]) {
  const ctx = await browser.newContext({ ...devices["Pixel 7"] });
  const page = await ctx.newPage();
  await page.route(/binance/, (r) => r.abort());
  await page.addInitScript(() => {
    window.__cls = [];
    new PerformanceObserver((l) => l.getEntries().forEach((e) => !e.hadRecentInput && window.__cls.push({ v: e.value, src: e.sources?.map((s) => s.node?.nodeName + "." + String(s.node?.className).slice(0, 50)) }))).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto("http://localhost:3100" + path);
  await page.waitForTimeout(6000);
  const cls = await page.evaluate(() => window.__cls);
  console.log(path, cls.reduce((a, e) => a + e.v, 0).toFixed(3), JSON.stringify(cls.slice(0, 4)));
  await ctx.close();
}
await browser.close();
