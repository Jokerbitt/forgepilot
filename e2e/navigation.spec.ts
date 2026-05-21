import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should load home page and display main heading', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/ForgePilot/);

    // Check for main navigation or heading
    const heading = page.locator('h1, h2, [role="heading"]').first();
    await expect(heading).toBeVisible();
  });

  test('should navigate to work-items page', async ({ page }) => {
    await page.goto('/');
    await page.goto('/work-items');

    // Verify page loaded
    await expect(page).toHaveURL(/\/work-items/);
    const pageContent = page.locator('body');
    await expect(pageContent).toBeVisible();
  });

  test('should navigate to delegations page', async ({ page }) => {
    await page.goto('/');
    await page.goto('/delegations');

    // Verify page loaded
    await expect(page).toHaveURL(/\/delegations/);
    const pageContent = page.locator('body');
    await expect(pageContent).toBeVisible();
  });

  test('should show navigation menu', async ({ page }) => {
    await page.goto('/');

    // Look for navigation elements (nav, sidebar, menu, etc.)
    const nav = page.locator('nav:visible, [role="navigation"]:visible, aside:visible, .sidebar:visible, .menu:visible').first();
    await expect(nav).toBeVisible();
  });
});
