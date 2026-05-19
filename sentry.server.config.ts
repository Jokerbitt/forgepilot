/**
 * Sentry Server Config — M97
 *
 * Node.js / edge runtime error capturing.
 * Instruments API routes and server components automatically.
 */

import * as Sentry from '@sentry/nextjs'

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    beforeSend(event, hint) {
      // Don't send 404s to Sentry — too noisy
      const err = hint.originalException
      if (err instanceof Error && err.message.includes('not found')) return null
      return event
    },
  })
}
