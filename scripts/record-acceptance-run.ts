#!/usr/bin/env tsx
/**
 * record-acceptance-run.ts — Records a JOK-189 acceptance test run.
 *
 * Appends a structured entry to config/execute-loop-evidence.json.
 *
 * Usage:
 *   npx tsx scripts/record-acceptance-run.ts \
 *     --title "Fix: Typo in Delegation Detail" \
 *     --provider anthropic \
 *     --brief-minutes 1.5 \
 *     --exec-minutes 8 \
 *     --has-pr true \
 *     --has-critic true \
 *     --has-writeback true \
 *     --interventions 0
 *     [--notes "Some observations"]
 */

import fs from 'fs'
import path from 'path'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AcceptanceRunEntry {
  id: string
  title: string
  provider: string
  briefMinutes: number
  execMinutes: number
  hasPR: boolean
  hasCritic: boolean
  hasWriteback: boolean
  interventions: number
  score: 'A' | 'B' | 'C'
  notes?: string
  recordedAt: string
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

function numArg(name: string): number {
  const val = arg(name)
  return val ? parseFloat(val) : 0
}

function calcScore(entry: Omit<AcceptanceRunEntry, 'score' | 'id' | 'recordedAt'>): 'A' | 'B' | 'C' {
  if (!entry.hasPR) return 'C'
  if (entry.interventions > 2) return 'C'
  if (entry.interventions > 0) return 'B'
  return 'A'
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const CONFIG_DIR = process.env.FORGEPILOT_DATA_DIR ?? path.join(process.cwd(), 'config')
const EVIDENCE_FILE = path.join(CONFIG_DIR, 'execute-loop-evidence.json')

const title = requireArg('title')
const provider = arg('provider') ?? 'unknown'
const briefMinutes = numArg('brief-minutes')
const execMinutes = numArg('exec-minutes')
const hasPR = boolArg('has-pr')
const hasCritic = boolArg('has-critic')
const hasWriteback = boolArg('has-writeback')
const interventions = Math.round(numArg('interventions'))
const notes = arg('notes')

const base = { title, provider, briefMinutes, execMinutes, hasPR, hasCritic, hasWriteback, interventions, notes }
const score = calcScore(base)

const entry: AcceptanceRunEntry = {
  id: `run-${Date.now()}`,
  ...base,
  score,
  recordedAt: new Date().toISOString(),
}

// Load existing evidence
let evidence: AcceptanceRunEntry[] = []
if (fs.existsSync(EVIDENCE_FILE)) {
  try {
    const raw = fs.readFileSync(EVIDENCE_FILE, 'utf-8')
    const parsed: unknown = JSON.parse(raw)
    evidence = Array.isArray(parsed) ? (parsed as AcceptanceRunEntry[]) : []
  } catch {
    // ignore parse errors — start fresh
  }
}

evidence.push(entry)
fs.writeFileSync(EVIDENCE_FILE, JSON.stringify(evidence, null, 2))

console.log(`\nRun recorded (Score: ${score})`)
console.log(`  Title:        ${title}`)
console.log(`  Provider:     ${provider}`)
console.log(`  Brief:        ${briefMinutes} min`)
console.log(`  Exec:         ${execMinutes} min`)
console.log(`  PR:           ${hasPR ? 'yes' : 'no'}`)
console.log(`  Critic:       ${hasCritic ? 'yes' : 'no'}`)
console.log(`  Writeback:    ${hasWriteback ? 'yes' : 'no'}`)
console.log(`  Interventions: ${interventions}`)
if (notes) console.log(`  Notes:        ${notes}`)
console.log(`\nTotal runs recorded: ${evidence.length}`)

// Summary stats
if (evidence.length >= 3) {
  const scoreA = evidence.filter(r => r.score === 'A').length
  const scoreB = evidence.filter(r => r.score === 'B').length
  const prRate = (evidence.filter(r => r.hasPR).length / evidence.length * 100).toFixed(0)
  const avgBrief = (evidence.reduce((s, r) => s + r.briefMinutes, 0) / evidence.length).toFixed(1)
  const avgExec = (evidence.reduce((s, r) => s + r.execMinutes, 0) / evidence.length).toFixed(1)
  console.log('\n--- Running Stats ---')
  console.log(`  Score A/B: ${scoreA + scoreB}/${evidence.length} (${((scoreA + scoreB) / evidence.length * 100).toFixed(0)}%)`)
  console.log(`  PR rate:   ${prRate}%`)
  console.log(`  Avg brief: ${avgBrief} min`)
  console.log(`  Avg exec:  ${avgExec} min`)
}
