/**
 * GET /api/dashboard/stats
 *
 * Single aggregated endpoint for the Command Center.
 * Replaces 7 separate fetches with one fast call.
 * Returns all KPIs needed to render the command center widgets.
 */

import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { Delegation } from '@/lib/models/delegation'
import { listRuns } from '@/lib/agents/orchestrated-run'
import { getPerformanceSummaries, getDriftWarnings, seedDemoOutcomes } from '@/lib/agents/skill-evolver'
import { getCards } from '@/lib/knowledge/store'

const DELEGATIONS_FILE = path.join(process.cwd(), 'config', 'delegations.json')

function readDelegations(): Delegation[] {
  try {
    if (!fs.existsSync(DELEGATIONS_FILE)) return []
    return JSON.parse(fs.readFileSync(DELEGATIONS_FILE, 'utf-8')) as Delegation[]
  } catch { return [] }
}

export interface DashboardStats {
  delegations: {
    total: number
    running: number
    pending: number
    approved: number
    failed: number
    completed: number
  }
  orchestrations: {
    total: number
    running: number
    done: number
    failed: number
    /** Latest 3 runs for the activity widget */
    recent: Array<{
      id: string
      title: string
      status: string
      taskCount: number
      doneTasks: number
      failedTasks: number
    }>
  }
  quality: {
    avgScore: number | null
    improving: number
    declining: number
    stable: number
    topWarning: { agentType: string; skillCategory: string; message: string } | null
  }
  knowledge: {
    cardCount: number
    recentCards: number   // added in last 7 days
  }
  generatedAt: string
}

export async function GET(): Promise<NextResponse<DashboardStats>> {
  // Delegations
  const delegations = readDelegations()
  const delegationStats = {
    total: delegations.length,
    running: delegations.filter(d => d.status === 'running').length,
    pending: delegations.filter(d => d.status === 'pending').length,
    approved: delegations.filter(d => d.status === 'approved').length,
    failed: delegations.filter(d => d.status === 'failed').length,
    completed: delegations.filter(d => d.status === 'completed').length,
  }

  // Orchestration runs
  const runs = listRuns()
  const recentRuns = [...runs]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3)
    .map(r => ({
      id: r.id,
      title: r.delegationTitle,
      status: r.status,
      taskCount: r.tasks.length,
      doneTasks: r.tasks.filter(t => t.status === 'done').length,
      failedTasks: r.tasks.filter(t => t.status === 'failed').length,
    }))

  const orchestrationStats = {
    total: runs.length,
    running: runs.filter(r => r.status === 'running').length,
    done: runs.filter(r => r.status === 'done').length,
    failed: runs.filter(r => r.status === 'failed').length,
    recent: recentRuns,
  }

  // Quality + Drift
  seedDemoOutcomes()
  const summaries = getPerformanceSummaries()
  const warnings = getDriftWarnings()
  const scores = summaries.map(s => s.averageScore)
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null

  const qualityStats = {
    avgScore,
    improving: summaries.filter(s => s.trend === 'improving').length,
    declining: summaries.filter(s => s.trend === 'declining').length,
    stable: summaries.filter(s => s.trend === 'stable').length,
    topWarning: warnings[0] ?? null,
  }

  // Knowledge
  const cards = getCards()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const knowledgeStats = {
    cardCount: cards.length,
    recentCards: cards.filter(c => c.createdAt >= sevenDaysAgo).length,
  }

  return NextResponse.json({
    delegations: delegationStats,
    orchestrations: orchestrationStats,
    quality: qualityStats,
    knowledge: knowledgeStats,
    generatedAt: new Date().toISOString(),
  })
}
