// Server-side Sentry initialization.
// Actual init happens in instrumentation.ts (Next.js 14 pattern).
// This file is required by @sentry/nextjs webpack plugin.
import * as Sentry from '@sentry/nextjs'

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
  })
}
