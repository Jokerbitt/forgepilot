/**
 * SMS connector — provider-agnostic text messaging (OTP, alerts, reminders).
 */

export interface SmsMessage {
  /** E.164 destination, e.g. +491701234567. */
  to: string
  body: string
  /** Optional override of the configured from number/sender id. */
  from?: string
}

export type SmsResult = { ok: true; id: string } | { ok: false; error: string }

export interface SmsProvider {
  readonly name: string
  send(message: SmsMessage): Promise<SmsResult>
}

/** Dev default — logs instead of sending. */
export class ConsoleSmsProvider implements SmsProvider {
  readonly name = 'console'
  async send(m: SmsMessage): Promise<SmsResult> {
    // eslint-disable-next-line no-console
    console.info('[sms:console]', m.to, '→', m.body.slice(0, 80))
    return { ok: true, id: `console-${Date.now()}` }
  }
}
