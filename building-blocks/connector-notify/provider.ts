/**
 * Notify connector — provider-agnostic outbound notifications.
 * One notify() call; route to Slack, a generic webhook, or console via env.
 */

export interface Notification {
  /** Short title / summary line. */
  title: string
  /** Optional longer body. */
  body?: string
  /** Optional severity — providers may colour/route on this. */
  level?: 'info' | 'success' | 'warning' | 'error'
  /** Optional structured context (rendered as fields where supported). */
  context?: Record<string, string | number | boolean>
}

export type NotifyResult = { ok: true } | { ok: false; error: string }

export interface NotifyProvider {
  readonly name: string
  send(notification: Notification): Promise<NotifyResult>
}

/** Dev default — logs instead of sending. */
export class ConsoleNotifyProvider implements NotifyProvider {
  readonly name = 'console'
  async send(n: Notification): Promise<NotifyResult> {
    // eslint-disable-next-line no-console
    console.info(`[notify:${n.level ?? 'info'}]`, n.title, n.body ?? '')
    return { ok: true }
  }
}
