import { expect, test } from "@playwright/test";

test("Phase 1 bootstrap page loads and redirects to login", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "NIRNAYA" })).toBeVisible();
});

test("Login page renders with form elements", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
});

test("Dashboard page renders with cards", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Open Tickets")).toBeVisible();
});
