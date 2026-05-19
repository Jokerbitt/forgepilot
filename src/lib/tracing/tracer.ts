/**
 * OpenTelemetry Tracer — M98
 *
 * Central tracer instance for ForgePilot.
 * Used to create spans around AI calls, delegation execution, and context building.
 *
 * Dev: export to Jaeger (docker run -p 4318:4318 jaegertracing/all-in-one)
 * Prod: export to Honeycomb or Vercel Observability via OTEL_EXPORTER_OTLP_ENDPOINT
 */

import { trace, type Tracer } from '@opentelemetry/api'

/**
 * The ForgePilot tracer — use this to create spans throughout the app.
 *
 * @example
 * const span = tracer.startSpan('delegation.execute')
 * try { ... } finally { span.end() }
 *
 * Or use withAISpan() from ai-span.ts for cleaner async wrapping.
 */
export const tracer: Tracer = trace.getTracer('forgepilot', '1.0.0')
