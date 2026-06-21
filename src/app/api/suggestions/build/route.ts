export const dynamic = 'force-dynamic'

/**
 * POST /api/suggestions/build
 * Body: { goal, context?, targetRepo?, selected: Suggestion[], custom?: string }
 *
 * Turns the user's selected suggestions (+ optional custom step) into a
 * validated, SEQUENTIAL delegation plan and starts it. Reuses the existing
 * plan → chain executor (build-gate + tests validate each phase before the
 * next), so the whole "select → plan → execute systematically until validated"
 * flow runs on proven infrastructure.
 */
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { requireAuth } from '@/lib/auth/require-auth'
import fs from 'fs'
import { savePlan } from '@/lib/delegations/plan-generator'
import { suggestionsToPlan } from '@/lib/suggestions/to-plan'
import type { Suggestion } from '@/lib/suggestions/generator'
import { ensureTargetRepo } from '@/lib/repo/create-repo'

export async function POST(req: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError

  let body: { goal?: string; context?: string; targetRepo?: string; selected?: Suggestion[]; custom?: string; totalBudgetUsd?: number }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 })
  }

  const goal = body.goal?.trim()
  if (!goal) return NextResponse.json({ error: 'goal ist erforderlich' }, { status: 400 })

  const selected = Array.isArray(body.selected) ? body.selected.filter(s => s && typeof s.title === 'string') : []
  const hasCustom = Boolean(body.custom && body.custom.trim())
  if (selected.length === 0 && !hasCustom) {
    return NextResponse.json({ error: 'Mindestens einen Vorschlag auswählen oder eigenen beschreiben' }, { status: 400 })
  }

  // Repo auto-creation: if a target repo is named but missing — or none is given
  // at all — create one so the user never has to run `git init` themselves.
  let targetRepo = body.targetRepo?.trim() || undefined
  let repoNote: string | undefined
  if (!targetRepo || !fs.existsSync(targetRepo)) {
    try {
      const repo = ensureTargetRepo({ appName: goal, targetPath: targetRepo })
      targetRepo = repo.path
      repoNote = repo.detail
    } catch {
      // Non-fatal: fall back to whatever was provided (or none).
    }
  }

  const plan = suggestionsToPlan({
    goal,
    context: body.context,
    targetRepo,
    selected,
    custom: body.custom,
    totalBudgetUsd: typeof body.totalBudgetUsd === 'number' && body.totalBudgetUsd > 0 ? body.totalBudgetUsd : undefined,
    newId: () => randomUUID(),
    now: new Date().toISOString(),
  })
  savePlan(plan)

  // Reuse the existing plan executor to create the validated sequential chain + start it.
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  try {
    const res = await fetch(`${baseUrl}/api/delegations/plan/${plan.id}/execute`, { method: 'POST' })
    const data = (await res.json()) as { delegationIds?: string[]; firstDelegationId?: string; error?: string }
    if (!res.ok) {
      return NextResponse.json({ error: data.error ?? 'Plan-Start fehlgeschlagen', planId: plan.id }, { status: 502 })
    }
    return NextResponse.json({
      planId: plan.id,
      phaseCount: plan.phases.length,
      delegationIds: data.delegationIds ?? [],
      firstDelegationId: data.firstDelegationId,
      targetRepo,
      repoNote,
    }, { status: 201 })
  } catch {
    // Plan is saved; the user can start it from the plan UI even if the auto-start failed.
    return NextResponse.json({ planId: plan.id, phaseCount: plan.phases.length, started: false }, { status: 201 })
  }
}
