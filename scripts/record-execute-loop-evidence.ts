#!/usr/bin/env npx tsx
import { randomUUID } from 'node:crypto'
import { parseArgs } from 'node:util'
import { register } from 'tsconfig-paths'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'

const tsconfigPath = resolve(process.cwd(), 'tsconfig.json')
const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8')) as {
  compilerOptions: { paths: Record<string, string[]>; baseUrl?: string }
}
register({
  baseUrl: resolve(process.cwd(), tsconfig.compilerOptions.baseUrl ?? '.'),
  paths: tsconfig.compilerOptions.paths,
})

import { appendExecuteLoopEvidence } from '@/lib/reports/execute-loop-evidence-store'
import type { DailyReportExecuteLoopEvidenceRun } from '@/lib/reports/daily-report'

const { values } = parseArgs({
  options: {
    title: { type: 'string' },
    status: { type: 'string', default: 'success' },
    id: { type: 'string' },
    'delegation-id': { type: 'string' },
    'brief-id': { type: 'string' },
    'pr-url': { type: 'string' },
    'time-saved': { type: 'string' },
    'manual-interventions': { type: 'string' },
    blocker: { type: 'string' },
    notes: { type: 'string' },
    brief: { type: 'boolean', default: false },
    delegation: { type: 'boolean', default: false },
    execute: { type: 'boolean', default: false },
    tests: { type: 'boolean', default: false },
    pr: { type: 'boolean', default: false },
    critic: { type: 'boolean', default: false },
    writeback: { type: 'boolean', default: false },
    all: { type: 'boolean', default: false },
  },
  strict: true,
})

function status(value: string | undefined): DailyReportExecuteLoopEvidenceRun['status'] {
  if (value === 'success' || value === 'partial' || value === 'blocked') return value
  throw new Error('Invalid --status. Use success, partial or blocked.')
}

function numberValue(value: string | undefined): number | undefined {
  if (!value) return undefined
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error(`Invalid number: ${value}`)
  return parsed
}

const markAll = Boolean(values.all)
const runStatus = status(values.status)
const run: DailyReportExecuteLoopEvidenceRun = {
  id: values.id ?? `evidence-${randomUUID()}`,
  title: values.title ?? 'Untitled execute loop evidence run',
  status: runStatus,
  source: 'manual',
  recordedAt: new Date().toISOString(),
  delegationId: values['delegation-id'],
  briefId: values['brief-id'],
  prUrl: values['pr-url'],
  timeSavedMinutes: numberValue(values['time-saved']),
  manualInterventions: numberValue(values['manual-interventions']),
  blocker: values.blocker,
  notes: values.notes,
  steps: {
    brief: markAll || Boolean(values.brief),
    delegation: markAll || Boolean(values.delegation),
    execute: markAll || Boolean(values.execute),
    tests: markAll || Boolean(values.tests),
    pr: markAll || Boolean(values.pr),
    critic: markAll || Boolean(values.critic),
    writeback: markAll || Boolean(values.writeback),
  },
}

const runs = appendExecuteLoopEvidence(run)
process.stdout.write(JSON.stringify({
  recorded: run.id,
  status: run.status,
  title: run.title,
  totalRuns: runs.length,
}, null, 2) + '\n')
