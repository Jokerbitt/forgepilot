export const dynamic = 'force-dynamic'
import { type NextRequest, NextResponse } from 'next/server'
import { sendTelegramMessage } from '@/lib/telegram/bot'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { text?: string }
    if (!body.text || typeof body.text !== 'string') {
      return NextResponse.json({ ok: false, error: 'text is required' }, { status: 400 })
    }
    const ok = await sendTelegramMessage(body.text, { parseMode: 'Markdown', disableWebPagePreview: true })
    return NextResponse.json({ ok })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
