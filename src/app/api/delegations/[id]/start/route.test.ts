import { describe, it, expect } from 'vitest'

describe('/api/delegations/[id]/start', () => {
  it('exports POST handler from execute route', async () => {
    const startModule = await import('./route')
    const executeModule = await import('../execute/route')

    expect(typeof startModule.POST).toBe('function')
    expect(startModule.POST).toBe(executeModule.POST)
  })
})
