import { expect, test } from "@playwright/test";

test("Phase 0 bootstrap page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "NIRNAYA" })).toBeVisible();
});
