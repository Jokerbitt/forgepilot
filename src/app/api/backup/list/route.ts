export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { listBackups } from '@/lib/config/backup'

export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json(listBackups())
  } catch (err) {
    return NextResponse.json({ error: 'Failed to list backups', detail: String(err) }, { status: 500 })
  }
}
