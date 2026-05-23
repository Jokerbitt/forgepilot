export const dynamic = 'force-dynamic'

import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import {
  appendExecuteLoopEvidence,
  readExecuteLoopEvidence,
} from '@/lib/reports/execute-loop-evidence-store'
import type { DailyReportExecuteLoopEvidenceRun } from '@/lib/reports/daily-report'
import { buildExecuteLoopEvidenceSummary } from '@/lib/reports/execute-loop-evidence-summary'
import { isValidationError, parseBody } from '@/lib/validation/api'
import { ExecuteLoopEvidenceRunSchema } from '@/lib/validation/schemas'

export async function GET() {
  const authError = await requireAuth()
  if (authError) return authError

  const runs = readExecuteLoopEvidence()
  const summary = buildExecuteLoopEvidenceSummary(runs)
  return NextResponse.json({
    runs,
    count: runs.length,
    provenRuns: summary.provenRuns,
    dryRuns: summary.dryRuns,
    summary,
  }, {
    headers: { 'cache-control': 'no-store' },
  })
}

export async function POST(request: Request) {
  const authError = await requireAuth()
  if (authError) return authError

  const input = await parseBody(request, ExecuteLoopEvidenceRunSchema)
  if (isValidationError(input)) return input

  const run: DailyReportExecuteLoopEvidenceRun = {
    id: input.id ?? `evidence-${randomUUID()}`,
    title: input.title,
    status: input.status,
    source: input.source,
    recordedAt: new Date().toISOString(),
    delegationId: input.delegationId,
    briefId: input.briefId,
    prUrl: input.prUrl,
    timeSavedMinutes: input.timeSavedMinutes,
    manualInterventions: input.manualInterventions,
    blocker: input.blocker,
    notes: input.notes,
    steps: input.steps,
  }

  const runs = appendExecuteLoopEvidence(run)
  const summary = buildExecuteLoopEvidenceSummary(runs)
  return NextResponse.json({
    recorded: run,
    count: runs.length,
    summary,
    warning: run.source === 'harness-dry-run'
      ? 'Dry-run evidence validates the harness but does not count as a proven real value loop.'
      : undefined,
  }, { status: 201 })
}
