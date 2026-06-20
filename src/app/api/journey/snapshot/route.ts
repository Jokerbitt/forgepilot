export const dynamic = 'force-dynamic'

/**
 * POST /api/journey/snapshot
 * Body: { action: 'create' | 'list' | 'restore', targetRepo: string, label?, ref? }
 * Returns: { snapshots } | { snapshot } | { restored, backup }
 *
 * Phase 2.3 — save a known-good state and safely return to it. Restore is
 * non-destructive (auto-backup + checkout into a new commit; never reset --hard).
 */
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import { requireAuth } from '@/lib/auth/require-auth'
import { listSnapshots, createSnapshot, restoreSnapshot } from '@/lib/journey/snapshot'

export async function POST(req: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError

  let body: { action?: string; targetRepo?: string; label?: string; ref?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 })
  }

  const targetRepo = body.targetRepo?.trim()
  if (!targetRepo) return NextResponse.json({ error: 'targetRepo ist erforderlich' }, { status: 400 })
  if (!fs.existsSync(targetRepo)) return NextResponse.json({ error: 'Ziel-Repo nicht gefunden' }, { status: 404 })
  if (!fs.existsSync(`${targetRepo}/.git`)) return NextResponse.json({ error: 'Kein Git-Repo — Snapshots brauchen Git' }, { status: 422 })

  try {
    switch (body.action) {
      case 'list':
        return NextResponse.json({ snapshots: listSnapshots(targetRepo) })
      case 'create':
        return NextResponse.json({ snapshot: createSnapshot(targetRepo, body.label ?? '') }, { status: 201 })
      case 'restore': {
        const ref = body.ref?.trim()
        if (!ref) return NextResponse.json({ error: 'ref ist erforderlich' }, { status: 400 })
        return NextResponse.json(restoreSnapshot(targetRepo, ref))
      }
      default:
        return NextResponse.json({ error: "action muss 'create', 'list' oder 'restore' sein" }, { status: 400 })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Snapshot-Aktion fehlgeschlagen: ${msg.slice(0, 160)}` }, { status: 500 })
  }
}
