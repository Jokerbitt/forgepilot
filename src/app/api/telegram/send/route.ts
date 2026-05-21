export const dynamic = 'force-dynamic'
import { type NextRequest, NextResponse } from 'next/server'
import { sendTelegramMessage } from '@/lib/telegram/bot'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { TelegramSendSchema } from '@/lib/validation/schemas'

export async function POST(req: NextRequest) {
  try {
    const body = await parseBody(req, TelegramSendSchema)
    if (isValidationError(body)) return body

    const ok = await sendTelegramMessage(body.text, { parseMode: 'Markdown', disableWebPagePreview: true })
    return NextResponse.json({ ok })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
