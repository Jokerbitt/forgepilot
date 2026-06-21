/**
 * Twilio SMS provider via the REST API (no SDK — Basic auth + form POST).
 * Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM (your Twilio number)
 */
import type { SmsMessage, SmsProvider, SmsResult } from './provider'

export class TwilioSmsProvider implements SmsProvider {
  readonly name = 'twilio'
  private sid: string
  private token: string
  private from: string

  constructor(env: NodeJS.ProcessEnv = process.env) {
    const sid = env.TWILIO_ACCOUNT_SID
    const token = env.TWILIO_AUTH_TOKEN
    const from = env.TWILIO_FROM
    if (!sid || !token || !from) throw new Error('TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM not set')
    this.sid = sid
    this.token = token
    this.from = from
  }

  async send(message: SmsMessage): Promise<SmsResult> {
    const auth = Buffer.from(`${this.sid}:${this.token}`).toString('base64')
    const body = new URLSearchParams({ To: message.to, From: message.from ?? this.from, Body: message.body })
    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.sid}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })
      const data = (await res.json()) as { sid?: string; message?: string }
      if (!res.ok || !data.sid) return { ok: false, error: data.message ?? `Twilio responded ${res.status}` }
      return { ok: true, id: data.sid }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'sms send failed' }
    }
  }
}
