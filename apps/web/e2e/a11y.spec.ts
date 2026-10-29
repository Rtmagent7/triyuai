import AxeBuilder from "@axe-core/playwright";
import { expect, hydrated, test } from "./fixtures";

/** PRD §9: WCAG 2.2 AA. Fails on any serious or critical axe violation. */
const pages = [
  "/",
  "/coins/bitcoin",
  "/highlights",
  "/converter",
  "/watchlist",
  "/ask",
  "/about",
  "/disclaimer",
  "/login",
  "/register",
];

for (const theme of ["dark", "light"] as const) {
  for (const path of pages) {
    // `binance` swaps the live feed for a silent mock: price-flash animations would
    // otherwise make contrast results depend on network timing.
    test(`a11y ${theme} ${path}`, async ({ page, binance }) => {
      void binance;
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
      await page.goto(path);
      await hydrated(page);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        // Third-party canvas chart is decorative; its data is exposed as text above it.
        .exclude("canvas")
        .analyze();
      const serious = results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );
      expect(
        serious.map(
          (v) => `${v.id}: ${v.help} (${v.nodes.length}) → ${v.nodes[0]?.target.join(" ")}`,
        ),
      ).toEqual([]);
    });
  }
}

test("chat panel is keyboard accessible and passes axe", async ({ page }) => {
  await page.goto("/");
  await hydrated(page);
  await page.getByRole("button", { name: "Open Ask TRIYU" }).focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Message Ask TRIYU" })).toBeFocused();
  const results = await new AxeBuilder({ page })
    .include("[role=dialog]")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    results.violations.filter((v) => v.impact === "serious" || v.impact === "critical"),
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
