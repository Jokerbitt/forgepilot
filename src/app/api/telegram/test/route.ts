export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { sendTestMessage } from '@/lib/telegram/bot'

export async function POST() {
  try {
    const ok = await sendTestMessage()
    return NextResponse.json({ ok })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
