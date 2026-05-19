/**
 * AI Span Helper — M98
 *
 * Wraps async functions in OpenTelemetry spans for distributed tracing.
 * Records duration, provider, model, and token counts as span attributes.
 *
 * Usage:
 *   const result = await withAISpan('delegation.execute', { delegationId }, async (span) => {
 *     return executeWork()
 *   })
 */

import { SpanStatusCode, type Attributes, type Span } from '@opentelemetry/api'
import { tracer } from './tracer'

/**
 * Wraps an async function in a named OTel span.
 * Records the span as an error if the function throws.
 */
export async function withAISpan<T>(
  name: string,
  attrs: Attributes,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(name, { attributes: attrs }, async (span) => {
    const t0 = Date.now()
    try {
      const result = await fn(span)
      span.setAttribute('duration_ms', Date.now() - t0)
      span.setStatus({ code: SpanStatusCode.OK })
      return result
    } catch (err) {
      span.setAttribute('duration_ms', Date.now() - t0)
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err instanceof Error ? err.message : String(err),
      })
      span.recordException(err instanceof Error ? err : new Error(String(err)))
      throw err
    } finally {
      span.end()
    }
  })
}

/**
 * Convenience wrapper for AI provider call spans.
 * Automatically sets standard AI attributes.
 */
export async function withProviderSpan<T>(
  provider: string,
  model: string,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return withAISpan(
    'ai.generate',
    {
      'ai.provider': provider,
      'ai.model': model,
      'span.kind': 'client',
    },
    fn,
  )
}
