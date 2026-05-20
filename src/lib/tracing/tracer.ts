/**
 * OpenTelemetry tracer — real implementation using @opentelemetry/api.
 *
 * When OTEL_EXPORTER_OTLP_ENDPOINT is set, the SDK is initialized via
 * instrumentation.ts → otel-setup.ts. This module uses the global OTel
 * trace API which is a no-op when no SDK is registered (safe for tests).
 *
 * Usage:
 *   await withSpan('ai.generate', { provider, model }, async (span) => {
 *     span.setAttribute('tokens', 1234)
 *     return generateText(...)
 *   })
 */

import { trace, SpanStatusCode, type Span as OtelSpan } from '@opentelemetry/api'

export type { OtelSpan as Span }

export function getTracer() {
  return trace.getTracer('forgepilot', '1.0.0')
}

export async function withSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean>,
  fn: (span: OtelSpan) => Promise<T>
): Promise<T> {
  const t = getTracer()
  return t.startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await fn(span)
      span.setStatus({ code: SpanStatusCode.OK })
      return result
    } catch (err) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err instanceof Error ? err.message : String(err),
      })
      throw err
    } finally {
      span.end()
    }
  })
}

// Legacy backward-compatible interface — keeps existing call sites working.
// Uses this.startSpan so tests can spy on it without breaking.
export const tracer = {
  startSpan(name: string, attrs?: Record<string, unknown>): OtelSpan {
    return getTracer().startSpan(name, {
      attributes: attrs as Record<string, string | number | boolean>,
    })
  },
  async withSpan<T>(
    name: string,
    attrs: Record<string, unknown>,
    fn: () => Promise<T>
  ): Promise<T> {
    const span = this.startSpan(name, attrs)
    try {
      const result = await fn()
      span.setStatus({ code: SpanStatusCode.OK })
      return result
    } catch (err) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err instanceof Error ? err.message : String(err),
      })
      throw err
    } finally {
      span.end()
    }
  },
}
