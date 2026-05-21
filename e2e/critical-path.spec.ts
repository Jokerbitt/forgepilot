import { test, expect } from '@playwright/test'

test.describe('Critical Path — Idea to Delegation', () => {
  test('homepage loads with navigation', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/ForgePilot/)
    const nav = page.locator('nav:visible, [role="navigation"]:visible, aside:visible').first()
    await expect(nav).toBeVisible()
  })

  test('idea page loads and has text input', async ({ page }) => {
    await page.goto('/idea')
    const input = page.locator('textarea, input[type="text"]').first()
    await expect(input).toBeVisible()
  })

  test('project briefs page loads', async ({ page }) => {
    await page.goto('/project-briefs')
    const body = page.locator('body')
    await expect(body).toBeVisible()
    // Should not show a 500 error
    await expect(page.locator(':text("Internal Server Error"), :text("500")')).toHaveCount(0)
  })

  test('knowledge page loads', async ({ page }) => {
    await page.goto('/knowledge')
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })

  test('analytics page loads', async ({ page }) => {
    await page.goto('/analytics')
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })

  test('search page loads', async ({ page }) => {
    await page.goto('/search')
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })
})
