/**
 * Sentry Client Configuration — M97
 *
 * Activated when NEXT_PUBLIC_SENTRY_DSN is set in env.
 * Get your DSN at https://sentry.io → Project → Settings → Client Keys
 *
 * Setup:
 *   1. Create a free Sentry account at https://sentry.io
 *   2. Create a project (Next.js)
 *   3. Copy DSN → add to .env.local: NEXT_PUBLIC_SENTRY_DSN=https://...
 *   4. Optional: SENTRY_AUTH_TOKEN for source map uploads
 */

import * as Sentry from '@sentry/nextjs'

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // 10% of transactions in prod, 100% in dev
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Session replays — disabled by default (privacy)
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    // ForgePilot tags for filtering
    initialScope: {
      tags: {
        app: 'forgepilot',
        env: process.env.NODE_ENV ?? 'unknown',
      },
    },

    // Ignore noisy browser errors
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
    ],
  })
}
