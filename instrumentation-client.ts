/**
 * Sentry Client Instrumentation (Next.js App Router)
 * Replaces the deprecated sentry.client.config.ts.
 */
import * as Sentry from '@sentry/nextjs'

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV ?? 'development',
  })
}

// Required for navigation instrumentation in Next.js App Router
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
