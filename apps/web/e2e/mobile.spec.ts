import { expect, hydrated, test } from "./fixtures";

const pages = [
  "/",
  "/coins/bitcoin",
  "/coins/monero",
  "/highlights",
  "/converter",
  "/watchlist",
  "/ask",
  "/about",
];

for (const path of pages) {
  test(`mobile: ${path} has no horizontal page scroll`, async ({ page }) => {
    await page.goto(path);
    await hydrated(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("mobile: market table scrolls inside its card with coin, price, 24h first", async ({
  page,
}) => {
  await page.goto("/");
  await hydrated(page);
  const table = page.getByRole("table");
  const scrolls = await table.evaluate(
    (t) => t.parentElement!.scrollWidth > t.parentElement!.clientWidth,
  );
  expect(scrolls).toBe(true);
  await expect(page.getByRole("columnheader", { name: /^Coin/ })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /^1h %/ })).toBeHidden();
});

test("mobile: menu closes after navigating, chat opens full-screen", async ({ page }) => {
  await page.goto("/");
  await hydrated(page);
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Highlights" }).click();
  await expect(page).toHaveURL(/\/highlights$/);
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.getByRole("button", { name: "Open Ask TRIYU" }).click();
  const sheet = page.getByRole("dialog");
  const box = (await sheet.boundingBox())!;
  expect(Math.round(box.width)).toBe(page.viewportSize()!.width);
});
