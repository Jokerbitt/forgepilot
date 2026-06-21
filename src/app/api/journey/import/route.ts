export const dynamic = 'force-dynamic'

/**
 * POST /api/journey/import
 * Body: { csvText: string, entityName?: string, targetRepo?: string, preview?: boolean }
 * Returns (preview): { analysis }
 * Returns (build):   { analysis, planId, phaseCount, delegationIds?, step }
 *
 * Phase 2.2 — import real CSV/TSV data. `preview:true` only analyzes (schema +
 * row count) so the UI can show what was detected. Without preview it also
 * creates a data-model + seed build step and starts it. Reuses analyzeDataset +
 * datasetToSeedStep + suggestionsToPlan + the executor.
 */
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import fs from 'fs'
import { requireAuth } from '@/lib/auth/require-auth'
import { analyzeDataset, datasetToSeedStep } from '@/lib/journey/data-import'
import { suggestionsToPlan } from '@/lib/suggestions/to-plan'
import { savePlan } from '@/lib/delegations/plan-generator'

export async function POST(req: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError

  let body: { csvText?: string; entityName?: string; targetRepo?: string; preview?: boolean }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 })
  }

  const csvText = body.csvText
  if (!csvText || !csvText.trim()) return NextResponse.json({ error: 'csvText ist erforderlich' }, { status: 400 })

  const analysis = analyzeDataset(csvText)
  if (analysis.columns.length === 0) return NextResponse.json({ error: 'Keine Spalten erkannt — ist es eine CSV/TSV?' }, { status: 422 })

  // Preview only: return the detected schema.
  if (body.preview) return NextResponse.json({ analysis })

  const targetRepo = body.targetRepo?.trim()
  if (!targetRepo) return NextResponse.json({ error: 'targetRepo ist erforderlich' }, { status: 400 })
  if (!fs.existsSync(targetRepo)) return NextResponse.json({ error: 'Ziel-Repo nicht gefunden' }, { status: 404 })

  const step = datasetToSeedStep(analysis, body.entityName?.trim() || 'Datensatz')
  if (!step) return NextResponse.json({ error: 'Keine Daten zum Importieren' }, { status: 422 })

  const plan = suggestionsToPlan({
    goal: `Daten importieren: ${step.title}`,
    context: 'Datenimport aus der Journey — bestehendes Verhalten erhalten.',
    targetRepo,
    selected: [{ id: 'd1', title: step.title, description: step.description }],
    newId: () => randomUUID(),
    now: new Date().toISOString(),
  })
  savePlan(plan)

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  try {
    const res = await fetch(`${baseUrl}/api/delegations/plan/${plan.id}/execute`, { method: 'POST' })
    const data = (await res.json()) as { delegationIds?: string[]; error?: string }
    if (!res.ok) {
      return NextResponse.json({ error: data.error ?? 'Start fehlgeschlagen', analysis, planId: plan.id, step }, { status: 502 })
    }
    return NextResponse.json({ analysis, planId: plan.id, phaseCount: plan.phases.length, delegationIds: data.delegationIds ?? [], step }, { status: 201 })
  } catch {
    return NextResponse.json({ analysis, planId: plan.id, phaseCount: plan.phases.length, step, started: false }, { status: 201 })
  }
}
