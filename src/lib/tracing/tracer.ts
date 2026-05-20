/**
 * OpenTelemetry tracer — no-op implementation.
 * Replace with real OTel when @opentelemetry/sdk-node is installed.
 *
 * Usage:
 *   const span = tracer.startSpan('ai.generate', { attributes: { provider } })
 *   try { ... } finally { span.end() }
 */

export interface Span {
  setAttribute(key: string, value: string | number | boolean): this
  end(): void
}

const noOpSpan: Span = {
  setAttribute() {
    return this
  },
  end() {},
}

export const tracer = {
  startSpan(_name: string, _attrs?: Record<string, unknown>): Span {
    return noOpSpan
  },
  /** Wraps an async function in a span */
  async withSpan<T>(
    name: string,
    attrs: Record<string, unknown>,
    fn: () => Promise<T>
  ): Promise<T> {
    const span = this.startSpan(name, attrs)
    try {
      return await fn()
    } finally {
      span.end()
    }
  },
}
