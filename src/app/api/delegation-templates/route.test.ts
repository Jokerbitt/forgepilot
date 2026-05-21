import { describe, it, expect } from 'vitest'
import { GET } from './route'

describe('GET /api/delegation-templates', () => {
  it('returns 5 templates', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json() as unknown[]
    expect(Array.isArray(data)).toBe(true)
    expect(data).toHaveLength(5)
  })
})
