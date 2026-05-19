import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatAge, isCreatedToday } from './delegation-age'

// Fixed "now" for deterministic tests: 2026-05-16T12:00:00Z
const FIXED_NOW = new Date('2026-05-16T12:00:00Z').getTime()

describe('formatAge', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const setup = () => vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW)

  it('returns gray text for < 30 minutes', () => {
    setup()
    const createdAt = new Date(FIXED_NOW - 10 * 60 * 1000).toISOString() // 10 min ago
    const result = formatAge(createdAt)
    expect(result.text).toBe('10m alt')
    expect(result.colorClass).toBe('text-gray-600')
  })

  it('returns yellow-600 for 30–240 minutes', () => {
    setup()
    const createdAt = new Date(FIXED_NOW - 90 * 60 * 1000).toISOString() // 90 min ago
    const result = formatAge(createdAt)
    expect(result.text).toBe('90m alt')
    expect(result.colorClass).toBe('text-yellow-600/70')
  })

  it('returns yellow-500 for 4–24 hours', () => {
    setup()
    const createdAt = new Date(FIXED_NOW - 6 * 60 * 60 * 1000).toISOString() // 6h ago
    const result = formatAge(createdAt)
    expect(result.text).toBe('6h alt')
    expect(result.colorClass).toBe('text-yellow-500')
  })

  it('returns red for >= 1 day', () => {
    setup()
    const createdAt = new Date(FIXED_NOW - 25 * 60 * 60 * 1000).toISOString() // 25h ago
    const result = formatAge(createdAt)
    expect(result.text).toBe('1d alt')
    expect(result.colorClass).toBe('text-red-400')
  })

  it('shows multiple days', () => {
    setup()
    const createdAt = new Date(FIXED_NOW - 3 * 24 * 60 * 60 * 1000).toISOString() // 3d ago
    const result = formatAge(createdAt)
    expect(result.text).toBe('3d alt')
    expect(result.colorClass).toBe('text-red-400')
  })
})

describe('isCreatedToday', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns true for today', () => {
    // Use real Date — test runs on the actual current date
    const today = new Date().toISOString()
    expect(isCreatedToday(today)).toBe(true)
  })

  it('returns false for yesterday', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    expect(isCreatedToday(yesterday)).toBe(false)
  })

  it('returns false for 2 days ago', () => {
    const old = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    expect(isCreatedToday(old)).toBe(false)
  })
})
