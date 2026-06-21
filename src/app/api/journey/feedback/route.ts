export const dynamic = 'force-dynamic'

/**
 * POST /api/journey/feedback
 * Body: { feedback: string, targetRepo: string }
 * Returns: { planId, phaseCount, delegationIds?, step }
 *
 * Phase 1.3 — turns natural-language feedback on a built app into a single
 * validated change and starts it against the same repo. Reuses feedbackToStep +
 * suggestionsToPlan + the plan executor.
 */
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import fs from 'fs'
import { requireAuth } from '@/lib/auth/require-auth'
import { feedbackToStep } from '@/lib/journey/feedback'
import { suggestionsToPlan } from '@/lib/suggestions/to-plan'
import { savePlan } from '@/lib/delegations/plan-generator'

export async function POST(req: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError

  let body: { feedback?: string; targetRepo?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 })
  }

  const targetRepo = body.targetRepo?.trim()
  if (!targetRepo) return NextResponse.json({ error: 'targetRepo ist erforderlich' }, { status: 400 })
  if (!fs.existsSync(targetRepo)) return NextResponse.json({ error: 'Ziel-Repo nicht gefunden' }, { status: 404 })

  const step = feedbackToStep(body.feedback ?? '')
  if (!step) return NextResponse.json({ error: 'Bitte beschreibe etwas genauer, was geändert werden soll.' }, { status: 400 })

  const plan = suggestionsToPlan({
    goal: `Änderung an bestehender App: ${step.title}`,
    context: 'Folge-Änderung aus Nutzer-Feedback — bestehendes Verhalten erhalten.',
    targetRepo,
    selected: [{ id: 'f1', title: step.title, description: step.description }],
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
