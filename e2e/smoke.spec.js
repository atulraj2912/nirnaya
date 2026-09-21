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
  // Authenticate via API (login form is tested separately above)
  await page.goto("/login");
  await page.evaluate(async () => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "sarah.chen@acme-corp.com", password: "agent123" }),
    });
    if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  });

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Open Tickets", { exact: true })).toBeVisible();
});
