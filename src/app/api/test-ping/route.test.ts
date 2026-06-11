/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest'
import { GET, POST, PUT, DELETE, PATCH } from './route'

describe('GET /api/test-ping', () => {
  it('returns 200 with { ok: true, ts: ISO string }', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; ts: string }
    expect(body.ok).toBe(true)
    expect(typeof body.ts).toBe('string')
    expect(() => new Date(body.ts).toISOString()).not.toThrow()
    expect(new Date(body.ts).toISOString()).toBe(body.ts)
  })
})

describe('Non-GET methods on /api/test-ping', () => {
  it.each([
    ['POST', POST],
    ['PUT', PUT],
    ['DELETE', DELETE],
    ['PATCH', PATCH],
  ])('returns 405 for %s', async (_method, handler) => {
    const res = await handler()
    expect(res.status).toBe(405)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('Method Not Allowed')
  })
})
