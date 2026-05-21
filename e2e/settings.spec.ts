import { test, expect } from '@playwright/test'

test.describe('Settings', () => {
  test('settings page loads', async ({ page }) => {
    await page.goto('/settings')
    await expect(page).toHaveURL(/\/settings/)
    const heading = page.locator('h1, h2, [role="heading"]').first()
    await expect(heading).toBeVisible()
  })

  test('settings providers page loads', async ({ page }) => {
    await page.goto('/settings/providers')
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })
})
