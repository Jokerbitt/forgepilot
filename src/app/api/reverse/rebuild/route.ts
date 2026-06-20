export const dynamic = 'force-dynamic'

/**
 * POST /api/reverse/rebuild
 * Body: { rootPath: string, options?: RebuildOptions, targetRepo?: string }
 * Returns: { planId, phaseCount, steps, delegationIds?, targetRepo, repoNote? }
 *
 * Turns a reverse-analysis into a validated, sequential rebuild plan and starts
 * it. Re-analyzes server-side (never trusts a client-supplied report), derives
 * rebuild steps, then reuses suggestionsToPlan → plan executor (build-gate +
 * tests per phase) and auto-creates the target repo if needed.
 */
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import fs from 'fs'
import { requireAuth } from '@/lib/auth/require-auth'
import { analyzeForReverse } from '@/lib/reverse/analyze'
import { reportToRebuildSteps, type RebuildOptions } from '@/lib/reverse/to-rebuild-plan'
import { suggestionsToPlan } from '@/lib/suggestions/to-plan'
import { savePlan } from '@/lib/delegations/plan-generator'
import { ensureTargetRepo } from '@/lib/repo/create-repo'

export async function POST(req: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError

  let body: { rootPath?: string; options?: RebuildOptions; targetRepo?: string; acknowledgeCritical?: boolean }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 })
  }

  const rootPath = body.rootPath?.trim()
  if (!rootPath) return NextResponse.json({ error: 'rootPath ist erforderlich' }, { status: 400 })

  const report = analyzeForReverse(rootPath)

  // Safety guardrail: never auto-rebuild safety-/mission-critical control software
  // without an explicit acknowledgement (Leitrechner/SCADA/PLC/…).
  if (report.criticality.level === 'critical' && !body.acknowledgeCritical) {
    return NextResponse.json({
      error: 'Kritische Steuerungssoftware erkannt — autonomer Nachbau gesperrt.',
      criticality: report.criticality,
      requiresAcknowledgement: true,
    }, { status: 409 })
  }
  const steps = reportToRebuildSteps(report, body.options ?? {})
  if (steps.length === 0) return NextResponse.json({ error: 'Keine Nachbau-Schritte ableitbar' }, { status: 422 })

  const goal = `Nachbau von ${report.appName}`
  const context = report.summary

  // Auto-create the target repo if missing — never make the user run git init.
  let targetRepo = body.targetRepo?.trim() || undefined
  let repoNote: string | undefined
  if (!targetRepo || !fs.existsSync(targetRepo)) {
    try {
      const repo = ensureTargetRepo({ appName: goal, targetPath: targetRepo })
      targetRepo = repo.path
      repoNote = repo.detail
    } catch {
      // Non-fatal — fall back to whatever was provided.
    }
  }

  const plan = suggestionsToPlan({
    goal,
    context,
    targetRepo,
    selected: steps.map((s, i) => ({ id: `r${i + 1}`, title: s.title, description: s.description })),
    newId: () => randomUUID(),
    now: new Date().toISOString(),
  })
  savePlan(plan)

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  try {
    const res = await fetch(`${baseUrl}/api/delegations/plan/${plan.id}/execute`, { method: 'POST' })
    const data = (await res.json()) as { delegationIds?: string[]; firstDelegationId?: string; error?: string }
    if (!res.ok) {
      return NextResponse.json({ error: data.error ?? 'Plan-Start fehlgeschlagen', planId: plan.id, phaseCount: plan.phases.length, steps }, { status: 502 })
    }
    return NextResponse.json({
      planId: plan.id,
      phaseCount: plan.phases.length,
      steps,
      delegationIds: data.delegationIds ?? [],
      firstDelegationId: data.firstDelegationId,
      targetRepo,
      repoNote,
    }, { status: 201 })
  } catch {
    return NextResponse.json({ planId: plan.id, phaseCount: plan.phases.length, steps, started: false, targetRepo }, { status: 201 })
  }
}
