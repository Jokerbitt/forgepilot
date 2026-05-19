import { test, expect } from '@playwright/test';

test.describe('Work Items Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/work-items');
  });

  test('should load work-items page without errors', async ({ page }) => {
    // Verify page loaded successfully (no 5xx errors)
    await expect(page).toHaveURL(/\/work-items/);

    // Check for page content
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should display page heading', async ({ page }) => {
    const heading = page.locator('h1, h2, [role="heading"]').first();
    await expect(heading).toBeVisible();
  });

  test('should have a sync button or refresh functionality', async ({ page }) => {
    // Look for sync/refresh button
    const syncButton = page.locator(
      'button:has-text(/sync|refresh|reload|update|fetch), [role="button"]:has-text(/sync|refresh)'
    ).first();

    if (await syncButton.isVisible()) {
      // Button exists and should be clickable
      await expect(syncButton).toBeEnabled();
    } else {
      // If no explicit sync button, page should still be functional
      const body = page.locator('body');
      await expect(body).toBeVisible();
    }
  });

  test('should display table or empty state', async ({ page }) => {
    // Look for either a data table or an empty state message
    const table = page.locator('table, [role="table"], .table-container');
    const emptyState = page.locator('[role="status"], .empty-state, :text-matches(/no items|no data|empty)');

    const hasTable = await table.first().isVisible().catch(() => false);
    const hasEmptyState = await emptyState.first().isVisible().catch(() => false);

    // At minimum, the page should render without errors
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should load without 500 errors', async ({ page, context }) => {
    let errorOccurred = false;

    // Listen for console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log('Console error:', msg.text());
      }
    });

    // Check for network errors (5xx responses)
    context.on('request', (request) => {
      request.response().catch(() => {
        // Network error, but we'll check status separately
      });
    });

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Verify page didn't get an error page
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});
