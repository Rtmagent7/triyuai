import { expect, test } from "./fixtures";

test("exchanges: ranked by Trust Score, sortable by volume, reachable from the footer", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "Exchanges" }).click();
  await expect(page).toHaveURL(/\/exchanges$/);
  await expect(page.getByRole("heading", { level: 1, name: "Exchanges" })).toBeVisible();
  await expect(page.getByRole("row")).toHaveCount(101);
  await page.getByRole("radio", { name: "24h volume" }).click();
  await expect(page.getByRole("radio", { name: "24h volume" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.getByRole("searchbox", { name: "Filter exchanges" }).fill("kraken");
  await expect(page.getByRole("row")).toHaveCount(2);
  await expect(page.getByRole("link", { name: /Kraken/ })).toHaveAttribute("target", "_blank");
});
