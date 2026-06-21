export const dynamic = 'force-dynamic'

/**
 * POST /api/journey/pwa
 * Body (check): { action?: 'check', rootPath: string }   // rootPath or targetRepo
 * Body (add):   { action: 'add', targetRepo: string, appName?: string }
 * Returns: PwaReport | { planId, phaseCount, delegationIds?, step }
 *
 * Phase 4.4 — Mobile/PWA. 'check' reports installability in plain German;
 * 'add' turns the built app into an installable PWA (manifest + service worker)
 * via the existing plan executor — an agent writes the deterministic files, so
 * there is no parallel file-writing logic here. Mirrors /api/journey/block.
 */
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import fs from 'fs'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkPwa, pwaPlanStep } from '@/lib/journey/pwa'
import { suggestionsToPlan } from '@/lib/suggestions/to-plan'
import { savePlan } from '@/lib/delegations/plan-generator'

export async function POST(req: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError

  let body: { action?: string; rootPath?: string; targetRepo?: string; appName?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 })
  }

  if (body.action === 'add') {
    const targetRepo = body.targetRepo?.trim()
    if (!targetRepo) return NextResponse.json({ error: 'targetRepo ist erforderlich' }, { status: 400 })
    if (!fs.existsSync(targetRepo)) return NextResponse.json({ error: 'Ziel-Repo nicht gefunden' }, { status: 404 })

    const step = pwaPlanStep(body.appName ?? 'Die App')
    const plan = suggestionsToPlan({
      goal: 'Als App fürs Handy einrichten (PWA)',
      context: 'PWA-Einrichtung aus der Journey — bestehendes Verhalten erhalten.',
      targetRepo,
      selected: [{ id: 'pwa1', title: step.title, description: step.description }],
      newId: () => randomUUID(),
      now: new Date().toISOString(),
    })
    savePlan(plan)

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
    try {
      const res = await fetch(`${baseUrl}/api/delegations/plan/${plan.id}/execute`, { method: 'POST' })
      const data = (await res.json()) as { delegationIds?: string[]; error?: string }
      if (!res.ok) {
        return NextResponse.json({ error: data.error ?? 'Start fehlgeschlagen', planId: plan.id, step }, { status: 502 })
      }
      return NextResponse.json({ planId: plan.id, phaseCount: plan.phases.length, delegationIds: data.delegationIds ?? [], step }, { status: 201 })
    } catch {
      return NextResponse.json({ planId: plan.id, phaseCount: plan.phases.length, step, started: false }, { status: 201 })
    }
  }

  // default: check
  const rootPath = body.rootPath?.trim() || body.targetRepo?.trim()
  if (!rootPath) return NextResponse.json({ error: 'rootPath ist erforderlich' }, { status: 400 })
  return NextResponse.json(checkPwa(rootPath))
}
