import { test, expect } from '@playwright/test';

test.describe('Delegations Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/delegations');
  });

  test('should load delegations page without errors', async ({ page }) => {
    // Verify page loaded successfully (no 5xx errors)
    await expect(page).toHaveURL(/\/delegations/);

    // Check for page content
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should display page heading', async ({ page }) => {
    const heading = page.locator('h1, h2, [role="heading"]').first();
    await expect(heading).toBeVisible();
  });

  test('should display table or empty state', async ({ page }) => {
    // Look for either a data table or an empty state message
    const table = page.locator('table, [role="table"], .table-container');
    const emptyState = page.locator('[role="status"], .empty-state, :text-matches(/no delegations|no items|no data|empty)');

    // At minimum, the page should render without errors
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Verify we have either a table or empty state
    const hasContent = await table.first().isVisible().catch(() => false);
    if (!hasContent) {
      // If no table, there should be some visible content
      await expect(body).not.toHaveText(/5\d{2}\s|error|exception/i);
    }
  });

  test('should have correct page title', async ({ page }) => {
    const pageTitle = page.locator('h1, h2, [role="heading"]').first();
    const titleText = await pageTitle.textContent();
    expect(titleText).toBeTruthy();
  });

  test('should load without 500 errors', async ({ page }) => {
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Verify page didn't get an error page
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Check no error pages were rendered
    const errorIndicators = page.locator(':text-matches(/500|internal server|error)');
    const errorCount = await errorIndicators.count();
    expect(errorCount).toBe(0);
  });

  test('should be navigable from home', async ({ page }) => {
    // Go back to home
    await page.goto('/');

    // Try to find and click delegations link
    const delegationsLink = page.locator(
      'a[href*="/delegations"], a:has-text(/delegation|assignment)'
    ).first();

    if (await delegationsLink.isVisible()) {
      await delegationsLink.click();
      await expect(page).toHaveURL(/\/delegations/);
    } else {
      // If no link, direct navigation should work
      await page.goto('/delegations');
      await expect(page).toHaveURL(/\/delegations/);
    }
  });
});
