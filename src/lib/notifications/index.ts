import { apiLogger } from '@/lib/logger'
import type { Delegation } from '@/lib/models/delegation'

export interface NotificationPayload {
  delegation: Delegation
  event: 'completed' | 'failed'
}

export interface BudgetWarningPayload {
  delegation: Delegation
  actualCostUsd: number
  maxBudgetUsd: number
  usagePct: number
}

const BUDGET_WARN_THRESHOLD = 0.8

/**
 * Fire a budget warning notification when actual cost reaches 80%+ of the budget.
 * Only fires if `usagePct >= BUDGET_WARN_THRESHOLD` and the run succeeded.
 * Never throws — errors are logged.
 */
export async function notifyBudgetWarning(payload: BudgetWarningPayload): Promise<void> {
  if (payload.usagePct < BUDGET_WARN_THRESHOLD) return

  const channels: Array<() => Promise<void>> = []

  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    channels.push(() => sendTelegramBudgetWarning(payload))
  }

  if (channels.length === 0) return

  await Promise.allSettled(channels.map(fn => fn().catch(err => {
    apiLogger.warn(
      { event: 'notification.budget_warning.error', error: err instanceof Error ? err.message : String(err) },
      'Budget warning notification failed'
    )
  })))
}

async function sendTelegramBudgetWarning(payload: BudgetWarningPayload): Promise<void> {
  const { sendTelegramMessage } = await import('@/lib/telegram/bot')
  const { delegation, actualCostUsd, maxBudgetUsd, usagePct } = payload
  const pct = Math.round(usagePct * 100)
  const text = `⚠️ ForgePilot Budget-Warnung\n` +
    `📋 ${delegation.title}\n` +
    `💰 $${actualCostUsd.toFixed(4)} / $${maxBudgetUsd.toFixed(4)} (${pct}% verbraucht)\n` +
    `🔗 /delegations/${delegation.id}`

  const sent = await sendTelegramMessage(text, { parseMode: 'Markdown', disableWebPagePreview: true })
  if (!sent) throw new Error('Telegram sendMessage returned false')

  apiLogger.info(
    { event: 'notification.budget_warning.sent', delegationId: delegation.id, usagePct },
    'Budget warning notification sent'
  )
}

/**
 * Send notification about delegation execution result.
 * Respects configured channels (Telegram, email).
 * Never throws — all errors logged.
 */
export async function notifyExecutionResult(payload: NotificationPayload): Promise<void> {
  const channels: Array<() => Promise<void>> = []

  // Telegram channel — reuse existing bot infrastructure
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    channels.push(() => sendTelegramNotification(payload))
  }

  // Email channel (Resend)
  if (process.env.RESEND_API_KEY && process.env.NOTIFICATION_EMAIL) {
    channels.push(() => sendEmailNotification(payload))
  }

  if (channels.length === 0) return // no channels configured

  await Promise.allSettled(channels.map(fn => fn().catch(err => {
    apiLogger.warn(
      { event: 'notification.error', error: err instanceof Error ? err.message : String(err) },
      'Notification channel failed'
    )
  })))
}

function buildMessage(payload: NotificationPayload): string {
  const { delegation, event } = payload
  const score = delegation.criticScore
  const prUrl = delegation.summaryReport?.prUrl
  const emoji = event === 'completed' ? '✅' : '❌'
  const scoreStr = score
    ? ` | Score: ${Math.round((score.correctness + score.efficiency + (100 - score.drift)) / 3)}/100 (${score.verdict})`
    : ''
  return `${emoji} ForgePilot: ${event === 'completed' ? 'Execution completed' : 'Execution failed'}\n` +
    `📋 ${delegation.title}${scoreStr}\n` +
    (prUrl ? `🔗 PR: ${prUrl}\n` : '') +
    (delegation.errorMessage ? `⚠️ Error: ${delegation.errorMessage.slice(0, 100)}\n` : '')
}

async function sendTelegramNotification(payload: NotificationPayload): Promise<void> {
  // Reuse existing sendTelegramMessage which already reads TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
  const { sendTelegramMessage } = await import('@/lib/telegram/bot')
  const text = buildMessage(payload)

  const sent = await sendTelegramMessage(text, {
    parseMode: 'Markdown',
    disableWebPagePreview: true,
  })

  if (!sent) {
    throw new Error('Telegram sendMessage returned false')
  }

  apiLogger.info(
    { event: 'notification.telegram.sent', delegationId: payload.delegation.id },
    'Telegram notification sent'
  )
}

async function sendEmailNotification(payload: NotificationPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY!
  const to = process.env.NOTIFICATION_EMAIL!
  const { delegation, event } = payload
  const subject = event === 'completed'
    ? `✅ ForgePilot: "${delegation.title}" completed`
    : `❌ ForgePilot: "${delegation.title}" failed`

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'ForgePilot <noreply@forgepilot.dev>',
      to,
      subject,
      text: buildMessage(payload),
    }),
  })

  if (!response.ok) {
    throw new Error(`Resend API error: ${response.status}`)
  }

  apiLogger.info(
    { event: 'notification.email.sent', delegationId: payload.delegation.id },
    'Email notification sent'
  )
}
