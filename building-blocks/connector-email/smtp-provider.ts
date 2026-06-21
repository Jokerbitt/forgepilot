/**
 * SMTP email provider (fallback, works with any SMTP server). Requires: npm i nodemailer
 * Env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM
 */
import nodemailer, { type Transporter } from 'nodemailer'
import type { EmailMessage, EmailProvider, EmailSendResult } from './provider'

export class SmtpEmailProvider implements EmailProvider {
  readonly name = 'smtp'
  private transport: Transporter
  private defaultFrom: string

  constructor(env: NodeJS.ProcessEnv = process.env) {
    const host = env.SMTP_HOST
    if (!host) throw new Error('SMTP_HOST is not set')
    this.defaultFrom = env.EMAIL_FROM ?? env.SMTP_USER ?? 'no-reply@localhost'
    this.transport = nodemailer.createTransport({
      host,
      port: Number(env.SMTP_PORT ?? 587),
      secure: Number(env.SMTP_PORT ?? 587) === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    })
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    try {
      const info = await this.transport.sendMail({
        from: message.from ?? this.defaultFrom,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        replyTo: message.replyTo,
      })
      return { ok: true, id: info.messageId }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'send failed' }
    }
  }
}
