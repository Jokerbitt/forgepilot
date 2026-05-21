import { describe, it, expect, vi } from 'vitest'
import { withRetry } from './retry'

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    expect(await withRetry(fn)).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries on retryable error and succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('rate limit'), { status: 429 }))
      .mockResolvedValue('ok')
    const result = await withRetry(fn, { maxAttempts: 3, initialDelayMs: 0 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('throws after max attempts', async () => {
    const fn = vi.fn().mockRejectedValue(Object.assign(new Error('overloaded'), { status: 529 }))
    await expect(withRetry(fn, { maxAttempts: 2, initialDelayMs: 0 })).rejects.toThrow()
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('does not retry non-retryable errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('validation error'))
    await expect(withRetry(fn, { maxAttempts: 3, initialDelayMs: 0 })).rejects.toThrow()
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
