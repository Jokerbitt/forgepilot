/**
 * Sentry integration — graceful no-op when SENTRY_DSN is not set.
 * Install @sentry/nextjs and configure sentry.client.config.ts to activate.
 */

export interface SentryEvent {
  message: string
  level?: 'error' | 'warning' | 'info'
  tags?: Record<string, string>
  extra?: Record<string, unknown>
}

/** Capture an error — no-op if Sentry not configured */
export function captureError(error: Error, context?: Record<string, unknown>): void {
  if (!process.env.SENTRY_DSN) return
  // When @sentry/nextjs is installed:
  // Sentry.captureException(error, { extra: context })
  console.error('[sentry-stub] Would capture:', error.message, context)
}

/** Set user context — no-op if Sentry not configured */
export function setSentryUser(id: string, email?: string): void {
  if (!process.env.SENTRY_DSN) return
  // Sentry.setUser({ id, email })
}

/** Create a Sentry span for performance tracking — returns no-op span */
export function startSpan(name: string, op: string): { finish: () => void } {
  return { finish: () => {} }
}
