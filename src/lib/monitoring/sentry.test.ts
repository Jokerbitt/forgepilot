import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { captureError, setSentryUser, startSpan } from './sentry'

describe('Sentry Stub', () => {
  const originalEnv = process.env.SENTRY_DSN
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

  beforeEach(() => {
    consoleSpy.mockClear()
  })

  afterEach(() => {
    process.env.SENTRY_DSN = originalEnv
  })

  describe('captureError', () => {
    it('should not throw when SENTRY_DSN is missing', () => {
      delete process.env.SENTRY_DSN
      const error = new Error('Test error')
      expect(() => captureError(error)).not.toThrow()
    })

    it('should be no-op when SENTRY_DSN is missing (no console.error call)', () => {
      delete process.env.SENTRY_DSN
      const error = new Error('Test error')
      captureError(error, { key: 'value' })
      expect(consoleSpy).not.toHaveBeenCalled()
    })

    it('should accept context as optional parameter', () => {
      delete process.env.SENTRY_DSN
      const error = new Error('Test error')
      expect(() => captureError(error, { context: 'data' })).not.toThrow()
    })

    it('should be called without error when DSN is not set', () => {
      delete process.env.SENTRY_DSN
      const error = new Error('Test')
      captureError(error)
      expect(consoleSpy).not.toHaveBeenCalled()
    })
  })

  describe('setSentryUser', () => {
    it('should not throw when SENTRY_DSN is missing', () => {
      delete process.env.SENTRY_DSN
      expect(() => setSentryUser('user-123')).not.toThrow()
    })

    it('should accept optional email parameter', () => {
      delete process.env.SENTRY_DSN
      expect(() => setSentryUser('user-123', 'user@example.com')).not.toThrow()
    })

    it('should work without email parameter', () => {
      delete process.env.SENTRY_DSN
      expect(() => setSentryUser('user-123')).not.toThrow()
    })
  })

  describe('startSpan', () => {
    it('should return object with finish method', () => {
      const span = startSpan('test', 'operation')
      expect(span).toHaveProperty('finish')
      expect(typeof span.finish).toBe('function')
    })

    it('should return object where finish method does not throw', () => {
      const span = startSpan('test', 'operation')
      expect(() => span.finish()).not.toThrow()
    })

    it('should accept name and operation parameters', () => {
      const span = startSpan('custom-span', 'custom-op')
      expect(span).toHaveProperty('finish')
    })

    it('should return new span instance each time', () => {
      const span1 = startSpan('test', 'op')
      const span2 = startSpan('test', 'op')
      expect(span1).not.toBe(span2)
    })
  })
})
