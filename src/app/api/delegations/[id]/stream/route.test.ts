import { describe, it, expect } from 'vitest'

describe('/api/delegations/[id]/stream', () => {
  it('exports a GET handler', async () => {
    const mod = await import('./route')
    expect(typeof mod.GET).toBe('function')
  })
})
