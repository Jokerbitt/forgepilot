/**
 * Next.js Instrumentation Hook
 * Initializes Sentry (server) and OpenTelemetry on server startup.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Sentry server initialization (only when SENTRY_DSN is set)
    if (process.env.SENTRY_DSN) {
      const Sentry = await import('@sentry/nextjs')
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        tracesSampleRate: 0.1,
        environment: process.env.NODE_ENV ?? 'development',
      })
    }

    // OpenTelemetry initialization (only when OTEL_EXPORTER_OTLP_ENDPOINT is set)
    if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
      const { registerOtelSDK } = await import('./src/lib/tracing/otel-setup')
      registerOtelSDK()
    }
  }
}
