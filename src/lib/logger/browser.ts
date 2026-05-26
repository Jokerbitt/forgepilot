/**
 * Browser-safe error capture utility — M322
 *
 * Client components cannot use Pino (Node.js-only). This module provides a
 * lightweight `captureError` function that:
 *   - Forwards to Sentry when NEXT_PUBLIC_SENTRY_DSN is set (M97)
 *   - Always logs to console.error in development for instant visibility
 *   - Silently swallows in production without Sentry (better than unhandled rejection noise)
 *
 * Usage in client components:
 *   import { captureError } from '@/lib/logger/browser'
 *   fetch('/api/foo').catch(err => captureError(err, 'component:fetch'))
 */

import * as Sentry from '@sentry/nextjs'

/**
 * Capture and report a client-side error.
 *
 * @param err    The caught error or value
 * @param context  Short identifier for where the error occurred (e.g. 'NBAPanel:fetch')
 */
export function captureError(err: unknown, context?: string): void {
  const isDev = process.env.NODE_ENV === 'development'

  if (isDev) {
    if (context) {
      // eslint-disable-next-line no-console
      console.error(`[${context}]`, err)
    } else {
      // eslint-disable-next-line no-console
      console.error(err)
    }
  }

  if (typeof Sentry?.captureException === 'function') {
    Sentry.captureException(err, context ? { tags: { context } } : undefined)
  }
}
