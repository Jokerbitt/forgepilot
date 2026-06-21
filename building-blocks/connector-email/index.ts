/**
 * Email connector entrypoint — resolves a provider from env and exposes a
 * single sendEmail() the rest of the app calls.
 *
 * EMAIL_PROVIDER = resend | smtp | console (default: console in dev)
 *
 * Usage:
 *   import { sendEmail } from '@/lib/email'
 *   await sendEmail({ to, subject: 'Welcome', html: '<p>Hi</p>' })
 */
import { ConsoleEmailProvider, type EmailMessage, type EmailProvider, type EmailSendResult } from './provider'

let cached: EmailProvider | null = null

export function resolveEmailProvider(env: NodeJS.ProcessEnv = process.env): EmailProvider {
  if (cached) return cached
  const choice = (env.EMAIL_PROVIDER ?? (env.RESEND_API_KEY ? 'resend' : env.SMTP_HOST ? 'smtp' : 'console')).toLowerCase()
  switch (choice) {
    case 'resend': {
      // Lazy require so the dependency is only needed when actually used.
      const { ResendEmailProvider } = require('./resend-provider') as typeof import('./resend-provider')
      cached = new ResendEmailProvider()
      break
    }
    case 'smtp': {
      const { SmtpEmailProvider } = require('./smtp-provider') as typeof import('./smtp-provider')
      cached = new SmtpEmailProvider(env)
      break
    }
    default:
      cached = new ConsoleEmailProvider()
  }
  return cached
}

export async function sendEmail(message: EmailMessage): Promise<EmailSendResult> {
  if (!message.text && !message.html) {
    return { ok: false, error: 'email requires text or html body' }
  }
  return resolveEmailProvider().send(message)
}

/** Reset the cached provider — useful in tests after changing env. */
export function __resetEmailProvider(): void {
  cached = null
}

export type { EmailMessage, EmailSendResult, EmailProvider } from './provider'
