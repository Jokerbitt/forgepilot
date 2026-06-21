export const dynamic = 'force-dynamic'

/**
 * POST /api/journey/block
 * Body: { blockId: string, targetRepo: string }
 * Returns: { planId, phaseCount, delegationIds?, step }
 *
 * Phase 2.1 — adds a ready-made building block (Login, payments, e-mail, …) to a
 * built app with one click. Reuses blockToStep + suggestionsToPlan + the executor.
 */
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import fs from 'fs'
import { requireAuth } from '@/lib/auth/require-auth'
import { blockToStep } from '@/lib/journey/blocks'
import { suggestionsToPlan } from '@/lib/suggestions/to-plan'
import { savePlan } from '@/lib/delegations/plan-generator'

export async function POST(req: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError

  let body: { blockId?: string; targetRepo?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 })
  }

  const targetRepo = body.targetRepo?.trim()
  if (!targetRepo) return NextResponse.json({ error: 'targetRepo ist erforderlich' }, { status: 400 })
  if (!fs.existsSync(targetRepo)) return NextResponse.json({ error: 'Ziel-Repo nicht gefunden' }, { status: 404 })

  const step = blockToStep(body.blockId ?? '')
  if (!step) return NextResponse.json({ error: 'Unbekannter Baustein' }, { status: 400 })

  const plan = suggestionsToPlan({
    goal: `Baustein hinzufügen: ${step.title}`,
    context: 'Vordefinierter Baustein aus der Journey — bestehendes Verhalten erhalten.',
    targetRepo,
    selected: [{ id: 'b1', title: step.title, description: step.description }],
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
