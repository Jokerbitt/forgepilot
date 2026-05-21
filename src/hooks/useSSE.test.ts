import { describe, it, expect } from 'vitest'
import { useSSE } from './useSSE'

describe('useSSE', () => {
  it('exports a function', () => {
    expect(typeof useSSE).toBe('function')
  })
})
