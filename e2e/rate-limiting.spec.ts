import { test, expect } from '@playwright/test'

test.describe('Rate Limiting', () => {
  test('health endpoint does not rate-limit reasonable requests', async ({ request }) => {
    // Make 5 quick requests — should all succeed (well under 100/min limit)
    for (let i = 0; i < 5; i++) {
      const res = await request.get('/api/health')
      expect(res.status()).not.toBe(429)
    }
  })
})
