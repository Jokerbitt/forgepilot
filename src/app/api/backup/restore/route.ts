export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { restoreBackup } from '@/lib/config/backup'

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url)
    let date = searchParams.get('date') ?? ''

    if (!date) {
      try {
        const body = await req.json() as { date?: string }
        date = typeof body.date === 'string' ? body.date : ''
      } catch {
        date = ''
      }
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date format — use YYYY-MM-DD' }, { status: 400 })
    }

    const restored = restoreBackup(date)
    return NextResponse.json({ restored, date, count: restored.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('Backup not found')) {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    return NextResponse.json({ error: 'Backup restore failed', detail: message }, { status: 500 })
  }
}
