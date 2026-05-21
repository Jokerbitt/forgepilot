/**
 * GET  /api/backup       — list all available backups
 * POST /api/backup       — create a new backup for today
 * POST /api/backup?restore=YYYY-MM-DD — restore a specific backup
 *
 * M161 — Config Backup Routine
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { runBackup, listBackups, restoreBackup } from '@/lib/config/backup'

export async function GET(): Promise<NextResponse> {
  try {
    const result = listBackups()
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to list backups', detail: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url)
    const restoreDate = searchParams.get('restore')

    if (restoreDate) {
      // Restore mode
      if (!/^\d{4}-\d{2}-\d{2}$/.test(restoreDate)) {
        return NextResponse.json(
          { error: 'Invalid date format — use YYYY-MM-DD' },
          { status: 400 },
        )
      }
      const restored = restoreBackup(restoreDate)
      return NextResponse.json({ restored, date: restoreDate, count: restored.length })
    }

    // Backup mode
    const result = runBackup()
    return NextResponse.json(result, { status: result.alreadyExisted ? 200 : 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('Backup not found')) {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    return NextResponse.json({ error: 'Backup operation failed', detail: message }, { status: 500 })
  }
}
