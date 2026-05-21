export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { handleTelegramUpdate, handleCallbackQuery } from '@/lib/telegram/commands'
import { sendTelegramMessage, answerCallbackQuery, editMessageText } from '@/lib/telegram/bot'
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

    // ── Inline keyboard button press ─────────────────────────────────────────
    if (update.callback_query) {
      const cbq = update.callback_query
      const result = handleCallbackQuery(cbq)

      if (result) {
        // 1. Acknowledge immediately (removes the spinner on the button)
        await answerCallbackQuery(cbq.id, result.toast)
        // 2. Replace original message text to reflect the taken action
        if (cbq.message?.chat.id != null && cbq.message.message_id) {
          await editMessageText(cbq.message.chat.id, cbq.message.message_id, result.editedText)
        }
      } else {
        await answerCallbackQuery(cbq.id)
      }

      return NextResponse.json({ ok: true })
    }

    // ── Regular text message / command ───────────────────────────────────────
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
