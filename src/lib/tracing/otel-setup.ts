/**
 * OpenTelemetry SDK Setup — M112
 *
 * Activated when OTEL_EXPORTER_OTLP_ENDPOINT is set.
 * Local dev: Jaeger all-in-one via Docker
 *   docker run -p 4318:4318 -p 16686:16686 jaegertracing/all-in-one
 *   OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
 *
 * Production: Honeycomb / Vercel Observability / any OTLP-compatible backend.
 */

import { NodeSDK } from '@opentelemetry/sdk-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'

let sdk: NodeSDK | undefined

export function registerOtelSDK(): void {
  if (sdk) return  // Already registered

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  if (!endpoint) return

  const exporter = new OTLPTraceExporter({ url: `${endpoint}/v1/traces` })

  sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'forgepilot',
    traceExporter: exporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable noisy auto-instrumentations for local dev
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
        '@opentelemetry/instrumentation-net': { enabled: false },
      }),
    ],
  })

  sdk.start()

  process.on('SIGTERM', () => {
    sdk?.shutdown().catch(console.error)
  })

  console.log(`[otel] Tracing initialized → ${endpoint}`)
}
