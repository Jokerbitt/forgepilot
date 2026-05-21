import { readTelegramConfig, isTelegramEnabled } from '@/lib/telegram/config'
import { telegramLogger } from '@/lib/logger'

const TELEGRAM_API = 'https://api.telegram.org/bot'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InlineKeyboardButton {
  text: string
  callback_data: string
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][]
}

export interface SendMessageOptions {
  parseMode?: 'Markdown' | 'HTML'
  disableWebPagePreview?: boolean
  /** Attach an inline keyboard to the message */
  replyMarkup?: InlineKeyboardMarkup
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SEVERITY_EMOJI: Record<string, string> = {
  critical: '🔴',
  warning:  '⚠️',
  info:     'ℹ️',
}

/** Build a standard ✅ Approve / ❌ Ablehnen keyboard for a delegation */
export function delegationApprovalKeyboard(delegationId: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [[
      { text: '✅ Genehmigen', callback_data: `approve_${delegationId}` },
      { text: '❌ Ablehnen',  callback_data: `reject_${delegationId}` },
    ]],
  }
}

export function formatNotification(notif: {
  title: string
  body: string
  severity: string
  type: string
  link?: string
}): string {
  const emoji = SEVERITY_EMOJI[notif.severity] ?? 'ℹ️'
  const sev = notif.severity.toUpperCase()
  let text = `${emoji} *${sev}* — ${notif.title}\n${notif.body}`
  if (notif.link) {
    text += `\n→ ${notif.link}`
  }
  return text
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function sendTelegramMessage(
  text: string,
  options?: SendMessageOptions,
): Promise<boolean> {
  if (!isTelegramEnabled()) return false
  const cfg = readTelegramConfig()
  if (!cfg) return false

  try {
    const body: Record<string, unknown> = {
      chat_id: cfg.chatId,
      text,
      parse_mode: options?.parseMode ?? 'Markdown',
      disable_web_page_preview: options?.disableWebPagePreview ?? true,
    }
    if (options?.replyMarkup) {
      body.reply_markup = options.replyMarkup
    }
    const res = await fetch(`${TELEGRAM_API}${cfg.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json() as { ok: boolean; description?: string }
    if (!data.ok) {
      telegramLogger.warn({ event: 'telegram.send_failed', description: data.description }, 'sendMessage failed')
    }
    return data.ok
  } catch (err) {
    telegramLogger.warn({ event: 'telegram.send_error', error: err instanceof Error ? err.message : String(err) }, 'sendMessage error')
    return false
  }
}

/**
 * Answer a callback_query (removes the loading spinner on the button).
 * text is shown as a toast notification in the Telegram client (max 200 chars).
 */
export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
): Promise<boolean> {
  const cfg = readTelegramConfig()
  if (!cfg) return false

  try {
    const res = await fetch(`${TELEGRAM_API}${cfg.botToken}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text?.slice(0, 200),
        show_alert: false,
      }),
    })
    const data = await res.json() as { ok: boolean }
    return data.ok
  } catch {
    return false
  }
}

/**
 * Edit the text of an already-sent message (e.g. after button press to mark it "done").
 */
export async function editMessageText(
  chatId: string | number,
  messageId: number,
  text: string,
): Promise<boolean> {
  const cfg = readTelegramConfig()
  if (!cfg) return false

  try {
    const res = await fetch(`${TELEGRAM_API}${cfg.botToken}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    })
    const data = await res.json() as { ok: boolean }
    return data.ok
  } catch {
    return false
  }
}

export async function sendTestMessage(): Promise<boolean> {
  return sendTelegramMessage(
    '🤖 *ForgePilot Telegram Bot ist bereit\\!*\nSende /help für alle Befehle\\.',
    { parseMode: 'Markdown' },
  )
}
