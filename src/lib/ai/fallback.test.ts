import { describe, it, expect, vi } from 'vitest'
import { withFallback } from './fallback'

describe('withFallback', () => {
  it('returns primary result when primary succeeds', async () => {
    const { result, usedFallback } = await withFallback(
      () => Promise.resolve('primary'),
      () => Promise.resolve('fallback'),
      { primaryId: 'p', fallbackId: 'f' }
    )
    expect(result).toBe('primary')
    expect(usedFallback).toBe(false)
  })

  it('uses fallback when primary fails', async () => {
    const { result, usedFallback } = await withFallback(
      () => Promise.reject(new Error('primary failed')),
      () => Promise.resolve('fallback'),
      { primaryId: 'p', fallbackId: 'f' }
    )
    expect(result).toBe('fallback')
    expect(usedFallback).toBe(true)
  })

  it('throws when both fail', async () => {
    await expect(withFallback(
      () => Promise.reject(new Error('primary')),
      () => Promise.reject(new Error('fallback')),
      { primaryId: 'p', fallbackId: 'f' }
    )).rejects.toThrow()
  })

  it('throws primary error when no fallback configured', async () => {
    await expect(withFallback(
      () => Promise.reject(new Error('primary')),
      undefined,
      { primaryId: 'p' }
    )).rejects.toThrow('primary')
  })
})
