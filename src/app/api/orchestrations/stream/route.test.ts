import { describe, it, expect } from 'vitest'

describe('/api/orchestrations/stream', () => {
  it('exports a GET handler', async () => {
    const mod = await import('./route')
    expect(typeof mod.GET).toBe('function')
  })
})
