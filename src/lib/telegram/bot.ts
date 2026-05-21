import { readTelegramConfig, isTelegramEnabled } from '@/lib/telegram/config'

const TELEGRAM_API = 'https://api.telegram.org/bot'

export interface SendMessageOptions {
  parseMode?: 'Markdown' | 'HTML'
  disableWebPagePreview?: boolean
}

const SEVERITY_EMOJI: Record<string, string> = {
  critical: '🔴',
  warning:  '⚠️',
  info:     'ℹ️',
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

export async function sendTelegramMessage(
  text: string,
  options?: SendMessageOptions,
): Promise<boolean> {
  if (!isTelegramEnabled()) return false
  const cfg = readTelegramConfig()
  if (!cfg) return false

  try {
    const res = await fetch(`${TELEGRAM_API}${cfg.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: cfg.chatId,
        text,
        parse_mode: options?.parseMode ?? 'Markdown',
        disable_web_page_preview: options?.disableWebPagePreview ?? true,
      }),
    })
    const data = await res.json() as { ok: boolean; description?: string }
    if (!data.ok) {
      // Log description but never log the token
      console.warn('[telegram] sendMessage failed:', data.description)
    }
    return data.ok
  } catch (err) {
    console.warn('[telegram] sendMessage error:', err instanceof Error ? err.message : err)
    return false
  }
}

export async function sendTestMessage(): Promise<boolean> {
  return sendTelegramMessage(
    '🤖 *ForgePilot Telegram Bot ist bereit\\!*\nSende /help für alle Befehle\\.',
    { parseMode: 'Markdown' },
  )
}
