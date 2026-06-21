/**
 * Resend email provider. Requires: npm i resend
 * Env: RESEND_API_KEY, EMAIL_FROM
 */
import { Resend } from 'resend'
import type { EmailMessage, EmailProvider, EmailSendResult } from './provider'

export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend'
  private client: Resend
  private defaultFrom: string

  constructor(apiKey = process.env.RESEND_API_KEY, defaultFrom = process.env.EMAIL_FROM) {
    if (!apiKey) throw new Error('RESEND_API_KEY is not set')
    if (!defaultFrom) throw new Error('EMAIL_FROM is not set')
    this.client = new Resend(apiKey)
    this.defaultFrom = defaultFrom
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    try {
      const { data, error } = await this.client.emails.send({
        from: message.from ?? this.defaultFrom,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        replyTo: message.replyTo,
      })
      if (error) return { ok: false, error: error.message }
      return { ok: true, id: data?.id ?? 'unknown' }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'send failed' }
    }
  }
}
