/**
 * Telegram Webhook Setup — M153
 *
 * POST — calls Telegram's setWebhook API to register the ForgePilot webhook URL.
 * The webhook URL is derived from NEXT_PUBLIC_BASE_URL + /api/telegram/webhook.
 *
 * Optional: if TELEGRAM_WEBHOOK_SECRET is set, it is forwarded as secret_token so
 * Telegram signs every incoming update — the webhook route verifies this header.
 */

export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { readTelegramConfig } from '@/lib/telegram/config'
import { logger } from '@/lib/logger'

const telegramLogger = logger.child({ module: 'telegram.setup-webhook' })

export async function POST(_req: NextRequest): Promise<NextResponse> {
  const cfg = readTelegramConfig()
  if (!cfg?.botToken) {
    return NextResponse.json(
      { ok: false, error: 'Telegram not configured — set bot token first' },
      { status: 400 },
    )
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '')
  if (!baseUrl) {
    return NextResponse.json(
      { ok: false, error: 'NEXT_PUBLIC_BASE_URL not set — cannot determine webhook URL' },
      { status: 400 },
    )
  }

  const webhookUrl = `${baseUrl}/api/telegram/webhook`
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET

  try {
    const body: Record<string, string> = { url: webhookUrl }
    if (secretToken) {
      body.secret_token = secretToken
    }

    const res = await fetch(
      `https://api.telegram.org/bot${cfg.botToken}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    )
    const data = await res.json() as { ok: boolean; description?: string; result?: boolean }

    telegramLogger.info({
      event: 'telegram.setup_webhook',
      webhookUrl,
      telegramOk: data.ok,
      description: data.description,
    })

    if (data.ok) {
      return NextResponse.json({ ok: true, webhookUrl, description: data.description })
    }
    return NextResponse.json(
      { ok: false, error: data.description ?? 'Telegram API error' },
      { status: 502 },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    telegramLogger.error({ event: 'telegram.setup_webhook.error', error: msg })
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

/** GET — returns the current webhook info from Telegram */
export async function GET(_req: NextRequest): Promise<NextResponse> {
  const cfg = readTelegramConfig()
  if (!cfg?.botToken) {
    return NextResponse.json({ ok: false, error: 'Telegram not configured' }, { status: 400 })
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${cfg.botToken}/getWebhookInfo`)
    const data = await res.json() as { ok: boolean; result?: unknown }
    return NextResponse.json(data)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
