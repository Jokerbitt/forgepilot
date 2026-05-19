/**
 * Sentry Client Config — M97
 *
 * Browser-side error capturing + performance monitoring.
 * Only active when NEXT_PUBLIC_SENTRY_DSN is set.
 */

import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,

    // Capture 10% of transactions for performance monitoring in prod
    // 100% in dev so you can see traces immediately
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Replay 10% of sessions, 100% with errors
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Don't capture errors for non-essential features
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
    ],

    beforeSend(event) {
      // Strip PII from the event message field (DSGVO Art. 5)
      // Breadcrumb scrubbing is handled server-side via sentry.server.config.ts
      if (event.message) {
        event.message = event.message.replace(
          /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
          '[EMAIL]',
        )
      }
      return event
    },
  })
}
