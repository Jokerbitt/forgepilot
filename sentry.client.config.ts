// Client-side Sentry initialization.
// Actual init happens in instrumentation-client.ts (Next.js 14 pattern).
// This file is required by @sentry/nextjs webpack plugin.
import * as Sentry from '@sentry/nextjs'

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
  })
}
