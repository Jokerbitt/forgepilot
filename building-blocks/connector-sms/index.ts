/**
 * SMS connector entrypoint — resolves a provider from env.
 *
 * SMS_PROVIDER = twilio | console (default: twilio if TWILIO_ACCOUNT_SID, else console)
 *
 * Usage:
 *   import { sendSms } from '@/lib/sms'
 *   await sendSms({ to: user.phone, body: `Your code is ${code}` })
 */
import { ConsoleSmsProvider, type SmsMessage, type SmsProvider, type SmsResult } from './provider'

let cached: SmsProvider | null = null

export function resolveSmsProvider(env: NodeJS.ProcessEnv = process.env): SmsProvider {
  if (cached) return cached
  const choice = (env.SMS_PROVIDER ?? (env.TWILIO_ACCOUNT_SID ? 'twilio' : 'console')).toLowerCase()
  if (choice === 'twilio') {
    const { TwilioSmsProvider } = require('./twilio') as typeof import('./twilio')
    cached = new TwilioSmsProvider(env)
  } else {
    cached = new ConsoleSmsProvider()
  }
  return cached
}

export async function sendSms(message: SmsMessage): Promise<SmsResult> {
  return resolveSmsProvider().send(message)
}

export function __resetSms(): void { cached = null }

export type { SmsMessage, SmsResult, SmsProvider } from './provider'
