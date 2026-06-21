/**
 * Generic outbound webhook notifier — POSTs the notification as JSON, with an
 * optional HMAC-SHA256 signature so the receiver can verify authenticity.
 * Env: NOTIFY_WEBHOOK_URL, NOTIFY_WEBHOOK_SECRET (optional)
 */
import { createHmac } from 'crypto'
import type { Notification, NotifyProvider, NotifyResult } from './provider'

export class WebhookNotifyProvider implements NotifyProvider {
  readonly name = 'webhook'
  private url: string
  private secret?: string

  constructor(url = process.env.NOTIFY_WEBHOOK_URL, secret = process.env.NOTIFY_WEBHOOK_SECRET) {
    if (!url) throw new Error('NOTIFY_WEBHOOK_URL is not set')
    this.url = url
    this.secret = secret
  }

  async send(n: Notification): Promise<NotifyResult> {
    const payload = JSON.stringify({ ...n, sentAt: new Date().toISOString() })
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.secret) {
      headers['X-Signature'] = `sha256=${createHmac('sha256', this.secret).update(payload).digest('hex')}`
    }
    try {
      const res = await fetch(this.url, { method: 'POST', headers, body: payload })
      if (!res.ok) return { ok: false, error: `Webhook responded ${res.status}` }
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'webhook send failed' }
    }
  }
}
