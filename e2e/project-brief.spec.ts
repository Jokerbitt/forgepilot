import { test, expect } from '@playwright/test'

test.describe('Project Brief Creation', () => {
  test('new brief page renders the form', async ({ page }) => {
    await page.goto('/project-briefs/new')
    // The form should have a title input or a textarea
    const input = page.locator('input[name="title"], input[placeholder*="title" i], textarea').first()
    await expect(input).toBeVisible()
  })

  test('API creates brief with valid data', async ({ request }) => {
    const res = await request.post('/api/project-briefs', {
      data: {
        title: 'E2E Test Brief',
        rawIdea: 'This is a raw idea that is long enough to pass validation checks in the system',
        problemStatement: 'Testing the E2E flow for brief creation',
        targetAudience: 'Developers',
        desiredOutcome: 'A verified E2E pipeline for brief creation',
        constraints: [],
        scope: 'standard',
        researchMode: 'standard',
        privacyMode: 'local',
      },
    })
    expect(res.status()).toBe(201)
    const body = await res.json() as Record<string, unknown>
    expect(body).toHaveProperty('id')
    expect(body.title).toBe('E2E Test Brief')
  })
})
