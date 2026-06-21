/**
 * PostHog analytics provider via the HTTP capture API (no SDK required).
 * Env: POSTHOG_KEY, POSTHOG_HOST (default https://eu.posthog.com for EU/DSGVO)
 */
import type { AnalyticsEvent, AnalyticsProvider } from './provider'

export class PostHogAnalyticsProvider implements AnalyticsProvider {
  readonly name = 'posthog'
  private key: string
  private host: string

  constructor(key = process.env.POSTHOG_KEY, host = process.env.POSTHOG_HOST ?? 'https://eu.posthog.com') {
    if (!key) throw new Error('POSTHOG_KEY is not set')
    this.key = key
    this.host = host.replace(/\/$/, '')
  }

  private async capture(body: Record<string, unknown>): Promise<void> {
    try {
      await fetch(`${this.host}/capture/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: this.key, ...body }),
      })
    } catch { /* analytics must never break a request */ }
  }

  async track(event: AnalyticsEvent): Promise<void> {
    await this.capture({ event: event.name, distinct_id: event.distinctId, properties: event.properties ?? {} })
  }

  async identify(distinctId: string, traits: Record<string, string | number | boolean> = {}): Promise<void> {
    await this.capture({ event: '$identify', distinct_id: distinctId, properties: { $set: traits } })
  }
}
