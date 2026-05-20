/**
 * Sentry Edge Configuration — M97
 *
 * Runs in Vercel Edge Runtime (middleware, edge API routes).
 * Same DSN as server, minimal config (no Node.js APIs available).
 */

import * as Sentry from '@sentry/nextjs'

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  })
}
