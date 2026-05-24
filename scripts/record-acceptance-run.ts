#!/usr/bin/env tsx
/**
 * record-acceptance-run.ts — Records a JOK-189 acceptance test run.
 *
 * Writes to config/execute-loop-evidence.json in the format expected by
 * the /api/execute-loop/evidence route and ExecuteLoopEvidenceWidget.
 *
 * Usage:
 *   npx tsx scripts/record-acceptance-run.ts \
 *     --title "Fix: Typo in Delegation Detail" \
 *     --has-pr true \
 *     --has-critic true \
 *     --has-writeback true \
 *     --time-saved 15 \
 *     --interventions 0 \
 *     [--pr-url "https://github.com/..." --notes "..."]
 */

import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

// ─── Types (mirrors DailyReportExecuteLoopEvidenceRun) ───────────────────────

interface EvidenceRun {
  id: string
  title: string
  status: 'success' | 'partial' | 'blocked'
  source: 'manual' | 'runtime-aggregate' | 'harness-dry-run'
  recordedAt: string
  prUrl?: string
  timeSavedMinutes?: number
  manualInterventions?: number
  blocker?: string
  notes?: string
  steps: {
    brief: boolean
    delegation: boolean
    execute: boolean
    tests: boolean
    pr: boolean
    critic: boolean
    writeback: boolean
  }
}

interface EvidenceFile {
  version: 1
  runs: EvidenceRun[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`)
  return idx !== -1 ? process.argv[idx + 1] : undefined
}

function requireArg(name: string): string {
  const val = arg(name)
  if (!val) {
    console.error(`ERROR: --${name} is required.`)
    process.exit(1)
  }
  return val
}

function boolArg(name: string): boolean {
  const val = arg(name)
  return val === 'true' || val === '1' || val === 'yes'
}

function boolArgDefault(name: string, defaultValue: boolean): boolean {
  return arg(name) === undefined ? defaultValue : boolArg(name)
}

function numArg(name: string): number | undefined {
  const val = arg(name)
  return val !== undefined ? parseFloat(val) : undefined
}

function calcStatus(steps: EvidenceRun['steps'], interventions: number): EvidenceRun['status'] {
  if (!steps.pr) return 'blocked'
  if (interventions > 2 || !steps.execute) return 'partial'
  return 'success'
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const CONFIG_DIR = process.env.FORGEPILOT_DATA_DIR ?? path.join(process.cwd(), 'config')
const EVIDENCE_FILE = path.join(CONFIG_DIR, 'execute-loop-evidence.json')

const title = requireArg('title')
const hasBrief = boolArgDefault('has-brief', true)
const hasDelegation = boolArgDefault('has-delegation', true)
const hasExecute = boolArgDefault('has-execute', true)
const hasTests = boolArg('has-tests')
const hasPR = boolArg('has-pr')
const hasCritic = boolArg('has-critic')
const hasWriteback = boolArg('has-writeback')
const timeSaved = numArg('time-saved')
const interventions = numArg('interventions') ?? 0
const prUrl = arg('pr-url')
const notes = arg('notes')
const blocker = arg('blocker')

const steps: EvidenceRun['steps'] = {
  brief: hasBrief,
  delegation: hasDelegation,
  execute: hasExecute,
  tests: hasTests,
  pr: hasPR,
  critic: hasCritic,
  writeback: hasWriteback,
}

const status = calcStatus(steps, Math.round(interventions))

const run: EvidenceRun = {
  id: `run-${randomUUID()}`,
  title,
  status,
  source: 'manual',
  recordedAt: new Date().toISOString(),
  ...(prUrl && { prUrl }),
  ...(timeSaved !== undefined && { timeSavedMinutes: timeSaved }),
  ...(interventions > 0 && { manualInterventions: Math.round(interventions) }),
  ...(blocker && { blocker }),
  ...(notes && { notes }),
  steps,
}

// Load or create evidence file
let evidenceFile: EvidenceFile = { version: 1, runs: [] }
if (fs.existsSync(EVIDENCE_FILE)) {
  try {
    const raw = fs.readFileSync(EVIDENCE_FILE, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<EvidenceFile>
    evidenceFile = {
      version: 1,
      runs: Array.isArray(parsed.runs) ? (parsed.runs as EvidenceRun[]) : [],
    }
  } catch {
    // ignore parse errors — start fresh
  }
}

evidenceFile.runs = [run, ...evidenceFile.runs].slice(0, 25)
fs.writeFileSync(EVIDENCE_FILE, JSON.stringify(evidenceFile, null, 2) + '\n')

const statusEmoji = { success: '✅', partial: '⚠️', blocked: '❌' }[status]
console.log(`\n${statusEmoji} Run recorded (status: ${status})`)
console.log(`  Title:       ${title}`)
console.log(`  PR:          ${hasPR ? 'yes' : 'no'}${prUrl ? ` → ${prUrl}` : ''}`)
console.log(`  Critic:      ${hasCritic ? 'yes' : 'no'}`)
console.log(`  Writeback:   ${hasWriteback ? 'yes' : 'no'}`)
if (interventions > 0) console.log(`  Interventions: ${Math.round(interventions)}`)
if (timeSaved) console.log(`  Time saved:  ${timeSaved} min`)
if (notes) console.log(`  Notes:       ${notes}`)

// Running stats
const runs = evidenceFile.runs
console.log(`\nTotal runs: ${runs.length}`)
if (runs.length >= 2) {
  const proven = runs.filter(r => r.status === 'success').length
  const partial = runs.filter(r => r.status === 'partial').length
  const prRate = (runs.filter(r => r.steps.pr).length / runs.length * 100).toFixed(0)
  console.log(`  Proven: ${proven}/${runs.length} — Partial: ${partial} — PR rate: ${prRate}%`)
  const jok189Done = proven + partial >= 4
  console.log(`  JOK-189 gate: ${jok189Done ? '✅ 4+ valid runs (M4 acceptance likely met)' : `⏳ ${proven + partial}/4 valid runs needed`}`)
}
