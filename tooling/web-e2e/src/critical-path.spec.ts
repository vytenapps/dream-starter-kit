import { expect, test } from "@playwright/test";

/**
 * Critical-path e2e: sign up, then create a project + item end-to-end.
 *
 * Runs against a LIVE local Supabase (`supabase start`, email confirmations off)
 * + the web app. In CI the workflow provisions both (Phase 8). Locally:
 *   supabase start && pnpm dev:next   # then: pnpm test:e2e
 */
test("sign up → create a project → add an item", async ({ page }) => {
  const stamp = Date.now();
  const email = `e2e-${stamp}@test.local`;

  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("E2E User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Create account" }).click();

  // Confirmations are off locally, so signup lands on the dashboard.
  await expect(page).toHaveURL(/\/dashboard/);

  // Create a project.
  const projectName = `E2E Project ${stamp}`;
  await page.goto("/projects");
  await page.getByPlaceholder("New project name").fill(projectName);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(projectName)).toBeVisible();

  // Open it and add an item.
  await page.getByRole("link", { name: projectName }).click();
  await page.getByPlaceholder("New item title").fill("First item");
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByText("First item")).toBeVisible();
});
