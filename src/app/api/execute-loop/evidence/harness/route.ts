export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import {
  appendExecuteLoopEvidence,
  readExecuteLoopEvidence,
} from '@/lib/reports/execute-loop-evidence-store'
import type { DailyReportExecuteLoopEvidenceRun } from '@/lib/reports/daily-report'
import { isValidationError, parseBody } from '@/lib/validation/api'
import { ExecuteLoopHarnessSchema } from '@/lib/validation/schemas'

const HARNESS_RUNS: DailyReportExecuteLoopEvidenceRun[] = [
  {
    id: 'harness-settings-provider-test',
    title: 'Settings provider connectivity check',
    status: 'partial',
    source: 'harness-dry-run',
    recordedAt: '',
    notes: 'Dry-run scenario: verifies that provider status, API-key safety and connection testing are observable from the app.',
    steps: {
      brief: true,
      delegation: true,
      execute: true,
      tests: true,
      pr: false,
      critic: true,
      writeback: false,
    },
  },
  {
    id: 'harness-daily-report-handoff',
    title: 'Daily Report handoff to external critic',
    status: 'partial',
    source: 'harness-dry-run',
    recordedAt: '',
    notes: 'Dry-run scenario: confirms that the Daily Report gives Grok/Claude/Codex actionable tasks without sharing secrets.',
    steps: {
      brief: true,
      delegation: true,
      execute: true,
      tests: true,
      pr: false,
      critic: true,
      writeback: true,
    },
  },
  {
    id: 'harness-small-ui-change',
    title: 'Small UI polish ticket',
    status: 'partial',
    source: 'harness-dry-run',
    recordedAt: '',
    notes: 'Dry-run scenario: models a safe frontend change with clear acceptance criteria and review evidence.',
    steps: {
      brief: true,
      delegation: true,
      execute: true,
      tests: true,
      pr: false,
      critic: true,
      writeback: false,
    },
  },
  {
    id: 'harness-api-guardrail',
    title: 'API guardrail and validation ticket',
    status: 'partial',
    source: 'harness-dry-run',
    notes: 'Dry-run scenario: models a backend guardrail task where validation, tests and auditability are mandatory.',
    recordedAt: '',
    steps: {
      brief: true,
      delegation: true,
      execute: true,
      tests: true,
      pr: false,
      critic: true,
      writeback: false,
    },
  },
  {
    id: 'harness-blocked-provider',
    title: 'Blocked provider escalation path',
    status: 'blocked',
    source: 'harness-dry-run',
    blocker: 'Provider unavailable or missing key',
    notes: 'Dry-run scenario: confirms the app can record a useful blocker instead of pretending the loop succeeded.',
    recordedAt: '',
    steps: {
      brief: true,
      delegation: true,
      execute: false,
      tests: false,
      pr: false,
      critic: false,
      writeback: true,
    },
  },
]

export async function POST(request: Request) {
  const authError = await requireAuth()
  if (authError) return authError

  const input = await parseBody(request, ExecuteLoopHarnessSchema)
  if (isValidationError(input)) return input

  const recordedAt = new Date().toISOString()
  const runs = HARNESS_RUNS.map(run => ({ ...run, recordedAt }))

  if (input.record) {
    for (const run of runs) {
      appendExecuteLoopEvidence(run)
    }
  }

  const storedRuns = input.record ? readExecuteLoopEvidence() : []
  return NextResponse.json({
    scenarioSet: input.scenarioSet,
    recorded: input.record,
    dryRunCount: runs.length,
    provenRealRuns: storedRuns.filter(run => run.source !== 'harness-dry-run' && run.status === 'success').length,
    warning: 'These are dry-run harness records. They validate observability and workflow shape, but they do not prove a real production loop.',
    runs,
  }, { status: input.record ? 201 : 200 })
}
