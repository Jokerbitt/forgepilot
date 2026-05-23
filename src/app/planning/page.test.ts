import { describe, it, expect } from 'vitest'

describe('PlanningPage', () => {
  it('exports PlanningPage as default', async () => {
    const mod = await import('./page')
    expect(typeof mod.default).toBe('function')
  })
})
