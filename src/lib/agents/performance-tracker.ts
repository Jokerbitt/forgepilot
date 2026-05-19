/**
 * Agent Performance Tracker
 *
 * Records every agent run and computes quality scores.
 * Used to learn from failures and improve future agent prompts.
 *
 * Quality Score (0–100):
 *   50  base
 * + 20  if tests were added
 * + 20  if PR was merged
 * + 10  if no lint warnings
 * - 25  per merge conflict
 * - 15  if self-healing was needed
 */

import fs from 'fs'
import path from 'path'

const STORE_FILE = path.join(process.cwd(), 'config', 'agent-performance.json')

export interface AgentRun {
  agentId: string
  taskDescription: string
  branch: string
  startedAt: string
  completedAt?: string
  durationMs?: number
  testsAdded: number
  filesChanged: number
  linesAdded: number
  mergeConflicts: number
  selfHealingUsed: boolean
  prMerged: boolean
  modelUsed: string
  estimatedCostUsd: number
  qualityScore: number
}

interface PerformanceStore {
  runs: AgentRun[]
  lastUpdated: string
}

function readStore(): PerformanceStore {
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf-8')
    return JSON.parse(raw) as PerformanceStore
  } catch {
    return { runs: [], lastUpdated: new Date().toISOString() }
  }
}

function writeStore(store: PerformanceStore): void {
  const dir = path.dirname(STORE_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  // Keep last 200 runs
  store.runs = store.runs.slice(-200)
  store.lastUpdated = new Date().toISOString()
  const tmp = STORE_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2))
  fs.renameSync(tmp, STORE_FILE)
}

function computeQualityScore(run: Omit<AgentRun, 'qualityScore'>): number {
  let score = 50
  if (run.testsAdded > 0) score += 20
  if (run.prMerged) score += 20
  if (run.mergeConflicts === 0) score += 10
  score -= run.mergeConflicts * 25
  if (run.selfHealingUsed) score -= 15
  return Math.max(0, Math.min(100, score))
}

export function recordAgentRun(run: Omit<AgentRun, 'qualityScore'>): AgentRun {
  const store = readStore()
  const full: AgentRun = { ...run, qualityScore: computeQualityScore(run) }
  store.runs.push(full)
  writeStore(store)
  return full
}

export function getAgentStats(): {
  totalRuns: number
  avgDurationMs: number
  mergeConflictRate: number
  avgQualityScore: number
  totalCostUsd: number
  costPerSuccessfulPR: number
} {
  const store = readStore()
  const runs = store.runs
  if (runs.length === 0) {
    return { totalRuns: 0, avgDurationMs: 0, mergeConflictRate: 0, avgQualityScore: 0, totalCostUsd: 0, costPerSuccessfulPR: 0 }
  }

  const completed = runs.filter(r => r.completedAt)
  const avgDurationMs = completed.length > 0
    ? completed.reduce((s, r) => s + (r.durationMs ?? 0), 0) / completed.length
    : 0

  const mergeConflictRate = runs.filter(r => r.mergeConflicts > 0).length / runs.length
  const avgQualityScore = runs.reduce((s, r) => s + r.qualityScore, 0) / runs.length
  const totalCostUsd = runs.reduce((s, r) => s + r.estimatedCostUsd, 0)
  const mergedPRs = runs.filter(r => r.prMerged).length
  const costPerSuccessfulPR = mergedPRs > 0 ? totalCostUsd / mergedPRs : 0

  return { totalRuns: runs.length, avgDurationMs, mergeConflictRate, avgQualityScore, totalCostUsd, costPerSuccessfulPR }
}

/** Derives best practices from high-scoring runs (score ≥ 85) */
export function getBestPractices(): string[] {
  const store = readStore()
  const good = store.runs.filter(r => r.qualityScore >= 85)
  if (good.length === 0) return ['Not enough data yet — need runs with quality score ≥ 85']

  const practices: string[] = []
  const avgTests = good.reduce((s, r) => s + r.testsAdded, 0) / good.length
  practices.push(`Add ≥${Math.ceil(avgTests)} tests per feature (avg in successful runs)`)

  const conflictFree = good.filter(r => r.mergeConflicts === 0).length / good.length
  if (conflictFree > 0.9) practices.push('Use file-lock-registry before editing shared files')

  const noHealing = good.filter(r => !r.selfHealingUsed).length / good.length
  if (noHealing > 0.8) practices.push('Run type-check before committing to avoid self-healing cycles')

  return practices
}

export function getRecentRuns(limit = 20): AgentRun[] {
  return readStore().runs.slice(-limit).reverse()
}
