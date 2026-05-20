import { describe, it, expect, vi } from 'vitest'
import { tracer, type Span } from './tracer'

describe('Tracer', () => {
  describe('startSpan', () => {
    it('should return span with setAttribute and end methods', () => {
      const span = tracer.startSpan('test', { key: 'value' })
      expect(span).toHaveProperty('setAttribute')
      expect(span).toHaveProperty('end')
      expect(typeof span.setAttribute).toBe('function')
      expect(typeof span.end).toBe('function')
    })

    it('should return span where setAttribute returns this for chaining', () => {
      const span = tracer.startSpan('test')
      const result = span.setAttribute('key', 'value')
      expect(result).toBe(span)
    })

    it('should return span where end does not throw', () => {
      const span = tracer.startSpan('test')
      expect(() => span.end()).not.toThrow()
    })

    it('should accept string, number, and boolean attribute values', () => {
      const span = tracer.startSpan('test')
      expect(() => {
        span.setAttribute('string', 'value')
        span.setAttribute('number', 42)
        span.setAttribute('boolean', true)
      }).not.toThrow()
    })
  })

  describe('withSpan', () => {
    it('should execute the function and return its result', async () => {
      const result = await tracer.withSpan('test', {}, async () => {
        return 'test-result'
      })
      expect(result).toBe('test-result')
    })

    it('should call span.end even if function throws', async () => {
      let spanEnded = false
      const originalStartSpan = tracer.startSpan
      tracer.startSpan = vi.fn((name, attrs) => {
        const span = originalStartSpan(name, attrs)
        const originalEnd = span.end
        span.end = () => {
          spanEnded = true
          originalEnd()
        }
        return span
      })

      try {
        await tracer.withSpan('test', {}, async () => {
          throw new Error('Test error')
        })
      } catch {
        // Expected
      }

      expect(spanEnded).toBe(true)
      tracer.startSpan = originalStartSpan
    })

    it('should pass name and attributes to startSpan', async () => {
      const startSpanSpy = vi.spyOn(tracer, 'startSpan')
      await tracer.withSpan('test-name', { attr: 'value' }, async () => {
        return 'result'
      })
      expect(startSpanSpy).toHaveBeenCalledWith('test-name', { attr: 'value' })
      startSpanSpy.mockRestore()
    })

    it('should work with various return types', async () => {
      const obj = { key: 'value' }
      const result = await tracer.withSpan('test', {}, async () => obj)
      expect(result).toBe(obj)
    })
  })

  describe('withAISpan', () => {
    it('should work as a convenience wrapper', async () => {
      const { withAISpan } = await import('./ai-span')
      const result = await withAISpan('openai', 'gpt-4', async () => {
        return 'ai-result'
      })
      expect(result).toBe('ai-result')
    })
  })
})
