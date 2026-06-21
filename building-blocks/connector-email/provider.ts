/**
 * Email connector — provider-agnostic interface.
 *
 * Lets the app send transactional email (verification, password reset,
 * notifications) without binding to one vendor. Swap the implementation via
 * EMAIL_PROVIDER without touching call sites.
 */

export interface EmailMessage {
  to: string | string[]
  subject: string
  /** Plain-text body. At least one of text/html is required. */
  text?: string
  /** HTML body. */
  html?: string
  /** Optional override of the configured from address. */
  from?: string
  replyTo?: string
}

export type EmailSendResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

export interface EmailProvider {
  readonly name: string
  send(message: EmailMessage): Promise<EmailSendResult>
}

/** Throwaway provider for local dev / tests — logs instead of sending. */
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = 'console'
  async send(message: EmailMessage): Promise<EmailSendResult> {
    // eslint-disable-next-line no-console
    console.info('[email:console]', message.subject, '→', message.to)
    return { ok: true, id: `console-${Date.now()}` }
  }
}
