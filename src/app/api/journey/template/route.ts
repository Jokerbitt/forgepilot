export const dynamic = 'force-dynamic'

/**
 * POST /api/journey/template
 * Body: { templateId: string, targetRepo?: string }
 * Returns: { planId, phaseCount, delegationIds?, targetRepo, repoNote? }
 *
 * Extra idea — start a new app from a ready-made template. Auto-creates the
 * target repo, then builds the template's features via the validated flow.
 */
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import fs from 'fs'
import { requireAuth } from '@/lib/auth/require-auth'
import { findTemplate, templateToSteps } from '@/lib/journey/templates'
import { suggestionsToPlan } from '@/lib/suggestions/to-plan'
import { savePlan } from '@/lib/delegations/plan-generator'
import { ensureTargetRepo } from '@/lib/repo/create-repo'

export async function POST(req: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError

  let body: { templateId?: string; targetRepo?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 })
  }

  const tpl = findTemplate(body.templateId ?? '')
  const steps = templateToSteps(body.templateId ?? '')
  if (!tpl || !steps) return NextResponse.json({ error: 'Unbekannte Vorlage' }, { status: 400 })

  // New app → auto-create the repo (never make the user run git init).
  let targetRepo = body.targetRepo?.trim() || undefined
  let repoNote: string | undefined
  if (!targetRepo || !fs.existsSync(targetRepo)) {
    try {
      const repo = ensureTargetRepo({ appName: tpl.name, targetPath: targetRepo })
      targetRepo = repo.path
      repoNote = repo.detail
    } catch {
      // non-fatal
    }
  }

  const plan = suggestionsToPlan({
    goal: tpl.goal,
    context: `Aus Vorlage „${tpl.name}".`,
    targetRepo,
    selected: steps.map((s, i) => ({ id: `t${i + 1}`, title: s.title, description: s.description })),
    newId: () => randomUUID(),
    now: new Date().toISOString(),
  })
  savePlan(plan)

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  try {
    const res = await fetch(`${baseUrl}/api/delegations/plan/${plan.id}/execute`, { method: 'POST' })
    const data = (await res.json()) as { delegationIds?: string[]; error?: string }
    if (!res.ok) {
      return NextResponse.json({ error: data.error ?? 'Start fehlgeschlagen', planId: plan.id }, { status: 502 })
    }
    return NextResponse.json({ planId: plan.id, phaseCount: plan.phases.length, delegationIds: data.delegationIds ?? [], targetRepo, repoNote }, { status: 201 })
  } catch {
    return NextResponse.json({ planId: plan.id, phaseCount: plan.phases.length, targetRepo, started: false }, { status: 201 })
  }
}
