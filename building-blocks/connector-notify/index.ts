/**
 * Notify connector entrypoint — resolves a provider from env.
 *
 * NOTIFY_PROVIDER = slack | webhook | console
 *   (default: slack if SLACK_WEBHOOK_URL, else webhook if NOTIFY_WEBHOOK_URL, else console)
 *
 * Usage:
 *   import { notify } from '@/lib/notify'
 *   await notify({ title: 'New signup', level: 'success', context: { email } })
 */
import { ConsoleNotifyProvider, type Notification, type NotifyProvider, type NotifyResult } from './provider'

let cached: NotifyProvider | null = null

export function resolveNotifyProvider(env: NodeJS.ProcessEnv = process.env): NotifyProvider {
  if (cached) return cached
  const choice = (env.NOTIFY_PROVIDER ?? (env.SLACK_WEBHOOK_URL ? 'slack' : env.NOTIFY_WEBHOOK_URL ? 'webhook' : 'console')).toLowerCase()
  if (choice === 'slack') {
    const { SlackNotifyProvider } = require('./slack') as typeof import('./slack')
    cached = new SlackNotifyProvider()
  } else if (choice === 'webhook') {
    const { WebhookNotifyProvider } = require('./webhook') as typeof import('./webhook')
    cached = new WebhookNotifyProvider()
  } else {
    cached = new ConsoleNotifyProvider()
  }
  return cached
}

export async function notify(notification: Notification): Promise<NotifyResult> {
  return resolveNotifyProvider().send(notification)
}

export function __resetNotify(): void { cached = null }

export type { Notification, NotifyResult, NotifyProvider } from './provider'
