/**
 * Slack notifier via an Incoming Webhook. No SDK needed.
 * Env: SLACK_WEBHOOK_URL
 */
import type { Notification, NotifyProvider, NotifyResult } from './provider'

const LEVEL_EMOJI: Record<string, string> = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '🚨' }

export class SlackNotifyProvider implements NotifyProvider {
  readonly name = 'slack'
  private webhookUrl: string

  constructor(webhookUrl = process.env.SLACK_WEBHOOK_URL) {
    if (!webhookUrl) throw new Error('SLACK_WEBHOOK_URL is not set')
    this.webhookUrl = webhookUrl
  }

  async send(n: Notification): Promise<NotifyResult> {
    const emoji = LEVEL_EMOJI[n.level ?? 'info'] ?? ''
    const fields = n.context
      ? Object.entries(n.context).map(([k, v]) => `• *${k}*: ${String(v)}`).join('\n')
      : ''
    const text = [`${emoji} *${n.title}*`, n.body, fields].filter(Boolean).join('\n')
    try {
      const res = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) return { ok: false, error: `Slack responded ${res.status}` }
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'slack send failed' }
    }
  }
}
