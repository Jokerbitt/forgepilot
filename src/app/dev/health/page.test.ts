import { describe, it, expect } from 'vitest'
import HealthPage from './page'

describe('HealthPage', () => {
  it('exports HealthPage as a function (React component)', () => {
    expect(typeof HealthPage).toBe('function')
  })
})
