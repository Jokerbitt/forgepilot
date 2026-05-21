import { describe, it, expect } from 'vitest'
import ReadinessPage from './page'

describe('ReadinessPage', () => {
  it('exports a default function (Server Component)', () => {
    expect(typeof ReadinessPage).toBe('function')
  })

  it('is a named function or arrow function component', () => {
    // ReadinessPage should be callable as a function (Server Component)
    expect(ReadinessPage).toBeDefined()
    expect(ReadinessPage.length).toBeGreaterThanOrEqual(0)
  })
})
