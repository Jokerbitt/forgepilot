export const dynamic = 'force-dynamic'

/**
 * POST /api/sentry/webhook
 *
 * Receives Sentry issue alerts and forwards them to Telegram.
 * Configure in Sentry: Settings → Integrations → Webhooks → add this URL.
 *
 * Supported Sentry actions: created, assigned, resolved, ignored
 */

import { NextRequest, NextResponse } from 'next/server'

interface SentryIssue {
  id: string
  title: string
  culprit?: string
  level?: string
  status?: string
  permalink?: string
  firstSeen?: string
  count?: string
}

interface SentryWebhookPayload {
  action: 'created' | 'resolved' | 'assigned' | 'ignored'
  actor?: { name?: string; email?: string }
  data: {
    issue?: SentryIssue
  }
}

const LEVEL_EMOJI: Record<string, string> = {
  fatal:   '💀',
  error:   '🔴',
  warning: '🟡',
  info:    'ℹ️',
  debug:   '🔵',
}

const ACTION_EMOJI: Record<string, string> = {
  created:  '🚨',
  resolved: '✅',
  assigned: '👤',
  ignored:  '🔕',
}

async function sendTelegram(text: string): Promise<void> {
  const token  = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!token || !chatId) return  // Telegram not configured — silent skip

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id:    chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  })
}

function buildMessage(payload: SentryWebhookPayload): string {
  const { action, data } = payload
  const issue = data.issue

  const actionEmoji = ACTION_EMOJI[action] ?? '📢'

  if (!issue) {
    return `${actionEmoji} <b>Sentry:</b> ${action}`
  }

  const levelEmoji = LEVEL_EMOJI[issue.level ?? 'error'] ?? '🔴'
  const title      = issue.title.slice(0, 200)
  const culprit    = issue.culprit ? `\n📍 <code>${issue.culprit.slice(0, 100)}</code>` : ''
  const count      = issue.count   ? ` · ${issue.count}× aufgetreten` : ''
  const link       = issue.permalink ? `\n🔗 <a href="${issue.permalink}">Sentry öffnen</a>` : ''

  const actionLabel: Record<string, string> = {
    created:  'Neuer Fehler',
    resolved: 'Behoben',
    assigned: 'Zugewiesen',
    ignored:  'Ignoriert',
  }

  return [
    `${actionEmoji} <b>ForgePilot ${actionLabel[action] ?? action}</b>`,
    `${levelEmoji} ${title}${count}`,
    culprit,
    link,
  ].filter(Boolean).join('\n')
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let payload: SentryWebhookPayload

  try {
    payload = await request.json() as SentryWebhookPayload
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  // Only alert on new errors and fatals — skip resolved/ignored to avoid noise
  if (payload.action === 'created') {
    const message = buildMessage(payload)
    await sendTelegram(message)
  }

  return NextResponse.json({ ok: true })
}

// Sentry sends a GET to verify the webhook URL
export function GET(): NextResponse {
  return NextResponse.json({ ok: true, service: 'forgepilot-sentry-webhook' })
}
