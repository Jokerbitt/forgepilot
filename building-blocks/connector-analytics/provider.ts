/**
 * Analytics connector — provider-agnostic product analytics.
 * Track events without binding to one vendor; swap via ANALYTICS_PROVIDER.
 */

export interface AnalyticsEvent {
  /** Event name, e.g. "generation.created". */
  name: string
  /** Stable user id (anonymous id is fine). */
  distinctId: string
  /** Event properties. */
  properties?: Record<string, string | number | boolean | null>
}

export interface AnalyticsProvider {
  readonly name: string
  track(event: AnalyticsEvent): Promise<void>
  identify(distinctId: string, traits?: Record<string, string | number | boolean>): Promise<void>
}

/** Dev default — logs instead of sending. */
export class ConsoleAnalyticsProvider implements AnalyticsProvider {
  readonly name = 'console'
  async track(event: AnalyticsEvent): Promise<void> {
    // eslint-disable-next-line no-console
    console.info('[analytics:track]', event.name, event.properties ?? {})
  }
  async identify(distinctId: string): Promise<void> {
    // eslint-disable-next-line no-console
    console.info('[analytics:identify]', distinctId)
  }
}
