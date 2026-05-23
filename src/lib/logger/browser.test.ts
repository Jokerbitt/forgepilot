import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock @sentry/nextjs before importing captureError
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

import { captureError } from './browser'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('captureError', () => {
  it('does not throw when called with an error', () => {
    expect(() => captureError(new Error('test'))).not.toThrow()
  })

  it('does not throw when called with a string', () => {
    expect(() => captureError('something went wrong')).not.toThrow()
  })

  it('does not throw when called with a context string', () => {
    expect(() => captureError(new Error('boom'), 'MyComponent:fetch')).not.toThrow()
  })

  it('forwards to Sentry captureException when module is available', async () => {
    const { captureException } = await import('@sentry/nextjs')
    captureError(new Error('sentry-test'), 'test-context')
    expect(vi.mocked(captureException)).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ tags: { context: 'test-context' } }),
    )
  })

  it('forwards to Sentry without tags when no context given', async () => {
    const { captureException } = await import('@sentry/nextjs')
    captureError(new Error('no-context'))
    expect(vi.mocked(captureException)).toHaveBeenCalledWith(
      expect.any(Error),
      undefined,
    )
  })
})
