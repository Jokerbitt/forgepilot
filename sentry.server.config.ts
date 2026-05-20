/**
 * Sentry Server Configuration — M97
 *
 * Runs in Node.js runtime (API routes, Server Components).
 * Activated when SENTRY_DSN (or NEXT_PUBLIC_SENTRY_DSN) is set.
 */

import * as Sentry from '@sentry/nextjs'

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,

    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    initialScope: {
      tags: {
        app: 'forgepilot',
        env: process.env.NODE_ENV ?? 'unknown',
        runtime: 'nodejs',
      },
    },
  })
}
