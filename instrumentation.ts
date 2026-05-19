/**
 * Next.js 14 Instrumentation Hook — M98
 *
 * Bootstraps OpenTelemetry for the Node.js runtime.
 * Only active on the server side (not in the browser / edge runtime).
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/open-telemetry
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { NodeSDK } = await import('@opentelemetry/sdk-node')
    const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node')
    const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http')
    const { resourceFromAttributes } = await import('@opentelemetry/resources')
    const { SEMRESATTRS_SERVICE_NAME } = await import('@opentelemetry/semantic-conventions')

    const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT

    const sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [SEMRESATTRS_SERVICE_NAME]: 'forgepilot',
      }),
      // Only configure exporter if endpoint is set — silently no-ops otherwise
      ...(endpoint
        ? {
            traceExporter: new OTLPTraceExporter({
              url: `${endpoint}/v1/traces`,
              headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
                ? Object.fromEntries(
                    process.env.OTEL_EXPORTER_OTLP_HEADERS.split(',').map(h => h.split('=')),
                  )
                : {},
            }),
          }
        : {}),
      instrumentations: [
        getNodeAutoInstrumentations({
          // Disable noisy file-system instrumentation
          '@opentelemetry/instrumentation-fs': { enabled: false },
        }),
      ],
    })

    sdk.start()
  }
}
