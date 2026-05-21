import { test, expect } from '@playwright/test'

test.describe('API Health', () => {
  test('GET /api/health returns 200', async ({ request }) => {
    const res = await request.get('/api/health')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('status')
  })

  test('GET /api/ready returns 200 or 503', async ({ request }) => {
    const res = await request.get('/api/ready')
    expect([200, 503]).toContain(res.status())
  })

  test('GET /api/dashboard/stats returns stats shape', async ({ request }) => {
    const res = await request.get('/api/dashboard/stats')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(typeof body.delegations.total).toBe('number')
    expect(typeof body.delegations.running).toBe('number')
    expect(typeof body.system.testsGreen).toBe('number')
  })

  test('GET /api/settings returns settings', async ({ request }) => {
    const res = await request.get('/api/settings')
    expect(res.status()).toBe(200)
  })

  test('POST to unknown route returns 404', async ({ request }) => {
    const res = await request.post('/api/nonexistent-endpoint-xyz')
    expect(res.status()).toBe(404)
  })
})
