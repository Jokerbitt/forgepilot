export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { handleTelegramUpdate } from '@/lib/telegram/commands'
import { sendTelegramMessage } from '@/lib/telegram/bot'
import type { TelegramUpdate } from '@/lib/telegram/commands'

export async function POST(request: Request) {
  try {
    // Optional webhook secret verification
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET
    if (secret) {
      const header = request.headers.get('X-Telegram-Bot-Api-Secret-Token')
      if (header !== secret) {
        return NextResponse.json({ ok: false }, { status: 403 })
      }
    }

    const update = await request.json() as TelegramUpdate
    const reply = await handleTelegramUpdate(update)

    if (reply) {
      await sendTelegramMessage(reply, { parseMode: 'Markdown', disableWebPagePreview: true })
    }

    // Telegram requires 200 OK always
    return NextResponse.json({ ok: true })
  } catch {
    // Never return non-200 to Telegram
    return NextResponse.json({ ok: true })
  }
}
