import { expect, test } from "./fixtures";

test("news: headlines by source, and a coin page shows its own", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "News" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "News" })).toBeVisible();
  const links = page.getByRole("link", { name: /opens on/ });
  await expect(links.first()).toHaveAttribute("target", "_blank");
  await page.getByRole("radio", { name: "The Block" }).click();
  await expect(links.first()).toHaveAccessibleName(/opens on The Block/);

  await page.goto("/coins/bitcoin");
  await expect(page.getByRole("heading", { name: "Latest news on Bitcoin" })).toBeVisible();
});
