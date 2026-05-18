/**
 * Skill Evolver
 *
 * Tracks agent performance outcomes per skill category.
 * Adjusts confidence scores over time — agents that consistently
 * deliver quality work gain confidence; drifting agents lose it.
 */

import fs from 'fs'
import path from 'path'
import type { AgentType, SkillCategory } from './agent-skills'
import { AGENT_PROFILES } from './agent-skills'
import type { TaskResult } from './orchestrated-run'

const HISTORY_PATH = path.join(process.cwd(), 'config', 'skill-history.json')

export interface SkillOutcome {
  agentType: AgentType
  skillCategory: SkillCategory
  score: number
  grade: string
  recordedAt: string
}

export interface SkillPerformanceSummary {
  agentType: AgentType
  skillCategory: SkillCategory
  averageScore: number
  taskCount: number
  trend: 'improving' | 'stable' | 'declining'
  currentConfidence: number
  recommendedConfidence: number
}

interface HistoryStore {
  outcomes: SkillOutcome[]
  updatedAt: string
}

function read(): HistoryStore {
  try {
    if (!fs.existsSync(HISTORY_PATH)) return { outcomes: [], updatedAt: new Date().toISOString() }
    return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf-8')) as HistoryStore
  } catch {
    return { outcomes: [], updatedAt: new Date().toISOString() }
  }
}

function write(store: HistoryStore): void {
  const dir = path.dirname(HISTORY_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = HISTORY_PATH + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2))
  fs.renameSync(tmp, HISTORY_PATH)
}

export function recordOutcome(
  agentType: AgentType,
  skillCategory: SkillCategory,
  result: TaskResult,
): void {
  const store = read()
  store.outcomes.push({
    agentType,
    skillCategory,
    score: result.qualityScore,
    grade: result.grade,
    recordedAt: new Date().toISOString(),
  })
  // Keep last 500 outcomes (rolling window)
  if (store.outcomes.length > 500) store.outcomes = store.outcomes.slice(-500)
  store.updatedAt = new Date().toISOString()
  write(store)
}

export function getPerformanceSummaries(): SkillPerformanceSummary[] {
  const store = read()
  const summaries: SkillPerformanceSummary[] = []

  // Group by agentType + skillCategory
  const groups: Record<string, SkillOutcome[]> = {}
  for (const outcome of store.outcomes) {
    const key = `${outcome.agentType}::${outcome.skillCategory}`
    groups[key] = groups[key] ?? []
    groups[key].push(outcome)
  }

  for (const [key, outcomes] of Object.entries(groups)) {
    const [agentType, skillCategory] = key.split('::') as [AgentType, SkillCategory]
    const scores = outcomes.map((o: SkillOutcome) => o.score)
    const avgScore = scores.reduce((a: number, b: number) => a + b, 0) / scores.length

    // Trend: compare last 5 vs previous 5
    const recent = scores.slice(-5)
    const previous = scores.slice(-10, -5)
    const recentAvg = recent.reduce((a: number, b: number) => a + b, 0) / (recent.length || 1)
    const prevAvg = previous.length
      ? previous.reduce((a: number, b: number) => a + b, 0) / previous.length
      : recentAvg
    const trend: SkillPerformanceSummary['trend'] =
      recentAvg > prevAvg + 5 ? 'improving' : recentAvg < prevAvg - 5 ? 'declining' : 'stable'

    // Current confidence from static profile
    const profile = AGENT_PROFILES[agentType]
    const skill = profile?.skills.find((s: { category: SkillCategory }) => s.category === skillCategory)
    const currentConfidence = skill?.confidence ?? 50

    // Recommended: weighted blend of static + observed average
    const recommendedConfidence = Math.round(currentConfidence * 0.3 + avgScore * 0.7)

    summaries.push({
      agentType,
      skillCategory,
      averageScore: Math.round(avgScore),
      taskCount: outcomes.length,
      trend,
      currentConfidence,
      recommendedConfidence,
    })
  }

  return summaries
}

export function getBestAgentForCategoryWithHistory(
  category: SkillCategory,
): AgentType {
  const summaries = getPerformanceSummaries().filter(s => s.skillCategory === category)

  if (summaries.length === 0) {
    // Fall back to static registry
    const { getBestAgentForCategory } = require('./agent-skills')
    return getBestAgentForCategory(category) as AgentType
  }

  // Pick agent with highest effective score (blend of static + observed)
  const best = summaries.reduce((a, b) =>
    (a.recommendedConfidence > b.recommendedConfidence ? a : b),
  )
  return best.agentType
}

export function getDriftWarnings(): { agentType: AgentType; skillCategory: SkillCategory; message: string }[] {
  return getPerformanceSummaries()
    .filter(s => s.trend === 'declining' && s.taskCount >= 3)
    .map(s => ({
      agentType: s.agentType,
      skillCategory: s.skillCategory,
      message: `${s.agentType} is declining in ${s.skillCategory}: avg score ${s.averageScore} (was ${s.recommendedConfidence})`,
    }))
}
