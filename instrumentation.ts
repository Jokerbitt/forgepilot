/**
 * Next.js instrumentation hook — M98 OpenTelemetry setup point.
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * When @opentelemetry packages are installed, initialize SDK here:
 */
export async function register() {
  // if (process.env.NEXT_RUNTIME === 'nodejs') {
  //   const { registerOtelSDK } = await import('./src/lib/tracing/otel-setup')
  //   registerOtelSDK()
  // }
}
