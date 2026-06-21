export const dynamic = 'force-dynamic'

/**
 * POST /api/journey/export
 * Body: { targetRepo: string }
 * Returns: application/zip (a backup of the app's committed state)
 *
 * Extra idea — app export/backup (no lock-in). Uses `git archive` (tracked files
 * only). Tip: take a Snapshot first to capture uncommitted changes.
 */
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import { requireAuth } from '@/lib/auth/require-auth'
import { buildRepoArchive, archiveFileName } from '@/lib/journey/export'

export async function POST(req: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError

  let body: { targetRepo?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 })
  }

  const targetRepo = body.targetRepo?.trim()
  if (!targetRepo) return NextResponse.json({ error: 'targetRepo ist erforderlich' }, { status: 400 })
  if (!fs.existsSync(targetRepo)) return NextResponse.json({ error: 'Ziel-Repo nicht gefunden' }, { status: 404 })
  if (!fs.existsSync(`${targetRepo}/.git`)) return NextResponse.json({ error: 'Kein Git-Repo — Export braucht Git' }, { status: 422 })

  try {
    const zip = buildRepoArchive(targetRepo)
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    return new NextResponse(new Uint8Array(zip), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${archiveFileName(targetRepo, stamp)}"`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Export fehlgeschlagen — gibt es schon einen Commit (HEAD)?' }, { status: 500 })
  }
}
