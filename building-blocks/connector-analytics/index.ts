/**
 * Analytics connector entrypoint — resolves a provider from env.
 *
 * ANALYTICS_PROVIDER = posthog | console (default: posthog if POSTHOG_KEY, else console)
 *
 * Usage:
 *   import { analytics } from '@/lib/analytics'
 *   await analytics().track({ name: 'generation.created', distinctId: user.id, properties: { model } })
 */
import { ConsoleAnalyticsProvider, type AnalyticsProvider } from './provider'

let cached: AnalyticsProvider | null = null

export function analytics(env: NodeJS.ProcessEnv = process.env): AnalyticsProvider {
  if (cached) return cached
  const choice = (env.ANALYTICS_PROVIDER ?? (env.POSTHOG_KEY ? 'posthog' : 'console')).toLowerCase()
  if (choice === 'posthog') {
    const { PostHogAnalyticsProvider } = require('./posthog') as typeof import('./posthog')
    cached = new PostHogAnalyticsProvider()
  } else {
    cached = new ConsoleAnalyticsProvider()
  }
  return cached
}

export function __resetAnalytics(): void { cached = null }

export type { AnalyticsEvent, AnalyticsProvider } from './provider'
