/**
 * Eval Harness — Measure what actually works
 *
 * Scores agent output across three dimensions:
 *   1. Correctness  — did the agent hit the acceptance criteria?
 *   2. Efficiency   — tokens/cost relative to quality achieved
 *   3. Drift        — how much did the agent stray from scope?
 *
 * Results are persisted (Supabase when available, JSON fallback).
 * Regression alerts fire when a case grade drops between runs.
 */

import fs from 'fs'
import path from 'path'
import { getDataDir } from '@/lib/config/paths'
import { getSupabaseClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EvalCase {
  id: string
  title: string
  prompt: string
  skillCategory?: string
  acceptanceCriteria: string[]
  goldenOutput?: string
  tags: string[]
  active: boolean
  createdAt: string
}

export interface EvalResult {
  id: string
  caseId: string
  delegationId?: string
  runId?: string
  // 3-dimension scores (0-100)
  correctnessScore: number
  efficiencyScore: number
  driftScore: number
  overallGrade: 'A' | 'B' | 'C' | 'D' | 'F'
  criteriaHit: boolean[]
  tokensUsed?: number
  costUsd?: number
  regression: boolean
  promptVariant?: string
  providerId?: string
  modelId?: string
  evaluatedAt: string
}

export interface EvalAlert {
  id: string
  caseId: string
  previousGrade: string
  currentGrade: string
  scoreDelta: number
  acknowledged: boolean
  createdAt: string
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

interface ScoreInput {
  criteria: string[]
  agentOutput: string
  tokensUsed?: number
  costUsd?: number
  filesChangedOutsideScope?: number
  totalFilesChanged?: number
}

/**
 * Score an agent's output against three dimensions.
 * Returns scores 0-100 for each dimension.
 */
export function scoreOutput(input: ScoreInput): {
  correctnessScore: number
  efficiencyScore: number
  driftScore: number
  criteriaHit: boolean[]
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
} {
  // 1. Correctness: how many acceptance criteria appear in the output
  const lowerOutput = input.agentOutput.toLowerCase()
  const criteriaHit = input.criteria.map(c => {
    const keywords = c.toLowerCase().split(/\s+/).filter(w => w.length > 4)
    return keywords.length === 0 ? true :
      keywords.filter(k => lowerOutput.includes(k)).length / keywords.length > 0.6
  })
  const correctnessScore = input.criteria.length > 0
    ? Math.round((criteriaHit.filter(Boolean).length / criteriaHit.length) * 100)
    : 75  // no criteria = assume OK

  // 2. Efficiency: reward low cost/token usage for the quality achieved
  //    Perfect = criteria met with < 2000 tokens; poor = > 10000 tokens for same
  const tokens = input.tokensUsed ?? 0
  const efficiencyScore = tokens === 0 ? 80 :
    tokens < 2_000  ? 95 :
    tokens < 5_000  ? 80 :
    tokens < 10_000 ? 60 :
    tokens < 20_000 ? 40 : 20

  // 3. Drift: penalty for touching files outside allowed scope
  const outsideScope = input.filesChangedOutsideScope ?? 0
  const driftScore = outsideScope === 0 ? 100 :
    outsideScope === 1 ? 75 :
    outsideScope <= 3  ? 50 : 20

  // Weighted overall: Correctness 50%, Efficiency 25%, Drift 25%
  const weighted = correctnessScore * 0.5 + efficiencyScore * 0.25 + driftScore * 0.25
  const grade: 'A' | 'B' | 'C' | 'D' | 'F' =
    weighted >= 90 ? 'A' :
    weighted >= 80 ? 'B' :
    weighted >= 70 ? 'C' :
    weighted >= 60 ? 'D' : 'F'

  return { correctnessScore, efficiencyScore, driftScore, criteriaHit, grade }
}

// ─── Storage (JSON fallback) ──────────────────────────────────────────────────

const CASES_FILE  = () => path.join(getDataDir(), 'eval-cases.json')
const RESULTS_FILE = () => path.join(getDataDir(), 'eval-results.json')
const ALERTS_FILE  = () => path.join(getDataDir(), 'eval-alerts.json')

function readJson<T>(file: string, defaultVal: T): T {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')) as T } catch { return defaultVal }
}

function writeJson(file: string, data: unknown): void {
  const dir = path.dirname(file)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = file + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8')
  fs.renameSync(tmp, file)
}

// ─── Case CRUD ────────────────────────────────────────────────────────────────

export function listEvalCases(): EvalCase[] {
  return readJson<EvalCase[]>(CASES_FILE(), [])
}

export function getEvalCase(id: string): EvalCase | undefined {
  return listEvalCases().find(c => c.id === id)
}

export function upsertEvalCase(c: Omit<EvalCase, 'createdAt'> & { createdAt?: string }): EvalCase {
  const cases = listEvalCases()
  const now   = new Date().toISOString()
  const full: EvalCase = { ...c, createdAt: c.createdAt ?? now }
  const idx   = cases.findIndex(x => x.id === c.id)
  if (idx >= 0) cases[idx] = full
  else          cases.push(full)
  writeJson(CASES_FILE(), cases)
  return full
}

export function deleteEvalCase(id: string): void {
  writeJson(CASES_FILE(), listEvalCases().filter(c => c.id !== id))
}

// ─── Result persistence ───────────────────────────────────────────────────────

export async function saveEvalResult(result: EvalResult): Promise<void> {
  // Supabase first
  const sb = getSupabaseClient()
  if (sb) {
    await sb.from('eval_results').upsert({
      id:                result.id,
      case_id:           result.caseId,
      delegation_id:     result.delegationId,
      run_id:            result.runId,
      correctness_score: result.correctnessScore,
      efficiency_score:  result.efficiencyScore,
      drift_score:       result.driftScore,
      overall_grade:     result.overallGrade,
      criteria_hit:      result.criteriaHit,
      tokens_used:       result.tokensUsed,
      cost_usd:          result.costUsd,
      regression:        result.regression,
      prompt_variant:    result.promptVariant,
      provider_id:       result.providerId,
      model_id:          result.modelId,
      evaluated_at:      result.evaluatedAt,
    })
    return
  }

  // JSON fallback
  const results = readJson<EvalResult[]>(RESULTS_FILE(), [])
  results.unshift(result)
  writeJson(RESULTS_FILE(), results.slice(0, 500))  // keep last 500
}

export function listEvalResults(caseId?: string): EvalResult[] {
  const all = readJson<EvalResult[]>(RESULTS_FILE(), [])
  return caseId ? all.filter(r => r.caseId === caseId) : all
}

export function getLastGrade(caseId: string): string | undefined {
  return listEvalResults(caseId)[0]?.overallGrade
}

// ─── Regression detection ─────────────────────────────────────────────────────

const GRADE_ORDER = ['A', 'B', 'C', 'D', 'F']

export function detectRegression(caseId: string, newGrade: string): EvalAlert | null {
  const prevGrade = getLastGrade(caseId)
  if (!prevGrade) return null

  const prevIdx = GRADE_ORDER.indexOf(prevGrade)
  const newIdx  = GRADE_ORDER.indexOf(newGrade)

  if (newIdx <= prevIdx) return null  // same or better — no regression

  const alert: EvalAlert = {
    id:            `alert-${Date.now()}`,
    caseId,
    previousGrade: prevGrade,
    currentGrade:  newGrade,
    scoreDelta:    newIdx - prevIdx,
    acknowledged:  false,
    createdAt:     new Date().toISOString(),
  }

  const alerts = readJson<EvalAlert[]>(ALERTS_FILE(), [])
  alerts.unshift(alert)
  writeJson(ALERTS_FILE(), alerts.slice(0, 100))

  return alert
}

export function listEvalAlerts(unacknowledgedOnly = true): EvalAlert[] {
  const all = readJson<EvalAlert[]>(ALERTS_FILE(), [])
  return unacknowledgedOnly ? all.filter(a => !a.acknowledged) : all
}

export function acknowledgeAlert(id: string): void {
  const alerts = readJson<EvalAlert[]>(ALERTS_FILE(), [])
  const idx    = alerts.findIndex(a => a.id === id)
  if (idx >= 0) { alerts[idx].acknowledged = true; writeJson(ALERTS_FILE(), alerts) }
}
