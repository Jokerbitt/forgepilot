import { NextResponse } from 'next/server'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'

export const dynamic = 'force-dynamic'

export interface AnalyticsData {
  summary: {
    totalExecutions: number
    completedCount: number
    failedCount: number
    successRate: number
    avgCostUsd: number
    totalCostUsd: number
  }
  criticScores: {
    avgCorrectness: number
    avgEfficiency: number
    avgDrift: number
    approvedCount: number
    needsRevisionCount: number
    rejectedCount: number
  }
  byRoute: Array<{
    route: string
    count: number
    successRate: number
    avgScore: number
  }>
  recentTrend: Array<{
    date: string
    completed: number
    failed: number
    avgScore: number
  }>
}

export async function GET(): Promise<Response> {
  try {
    const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
    const all = await repo.listByStatus()

    const executed = all.filter(d => d.status === 'completed' || d.status === 'failed')
    const completed = executed.filter(d => d.status === 'completed')
    const failed = executed.filter(d => d.status === 'failed')

    // Summary
    const totalCostUsd = executed.reduce((sum, d) => sum + (d.actualCostUsd ?? d.costEstimateUsd ?? 0), 0)
    const avgCostUsd = executed.length > 0 ? totalCostUsd / executed.length : 0
    const successRate = executed.length > 0 ? (completed.length / executed.length) * 100 : 0

    // Critic scores
    const withScores = completed.filter(d => d.criticScore)
    const avgCorrectness = withScores.length > 0
      ? withScores.reduce((s, d) => s + (d.criticScore!.correctness), 0) / withScores.length : 0
    const avgEfficiency = withScores.length > 0
      ? withScores.reduce((s, d) => s + (d.criticScore!.efficiency), 0) / withScores.length : 0
    const avgDrift = withScores.length > 0
      ? withScores.reduce((s, d) => s + (d.criticScore!.drift), 0) / withScores.length : 0

    // By route
    const routeMap = new Map<string, { total: number; success: number; scoreSum: number; scoreCount: number }>()
    for (const d of executed) {
      const route = d.executionRoute ?? 'unknown'
      const entry = routeMap.get(route) ?? { total: 0, success: 0, scoreSum: 0, scoreCount: 0 }
      entry.total++
      if (d.status === 'completed') entry.success++
      if (d.criticScore) {
        entry.scoreSum += (d.criticScore.correctness + d.criticScore.efficiency + (100 - d.criticScore.drift)) / 3
        entry.scoreCount++
      }
      routeMap.set(route, entry)
    }
    const byRoute = Array.from(routeMap.entries()).map(([route, e]) => ({
      route,
      count: e.total,
      successRate: e.total > 0 ? Math.round((e.success / e.total) * 100) : 0,
      avgScore: e.scoreCount > 0 ? Math.round(e.scoreSum / e.scoreCount) : 0,
    }))

    // Recent trend (last 14 days, grouped by date)
    const now = Date.now()
    const days = 14
    const trendMap = new Map<string, { completed: number; failed: number; scoreSum: number; scoreCount: number }>()
    for (let i = 0; i < days; i++) {
      const d = new Date(now - i * 86_400_000)
      trendMap.set(d.toISOString().slice(0, 10), { completed: 0, failed: 0, scoreSum: 0, scoreCount: 0 })
    }
    for (const d of executed) {
      const date = (d.updatedAt ?? d.createdAt ?? '').slice(0, 10)
      if (trendMap.has(date)) {
        const entry = trendMap.get(date)!
        if (d.status === 'completed') entry.completed++
        else entry.failed++
        if (d.criticScore) {
          entry.scoreSum += (d.criticScore.correctness + d.criticScore.efficiency + (100 - d.criticScore.drift)) / 3
          entry.scoreCount++
        }
      }
    }
    const recentTrend = Array.from(trendMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, e]) => ({
        date,
        completed: e.completed,
        failed: e.failed,
        avgScore: e.scoreCount > 0 ? Math.round(e.scoreSum / e.scoreCount) : 0,
      }))

    const data: AnalyticsData = {
      summary: {
        totalExecutions: executed.length,
        completedCount: completed.length,
        failedCount: failed.length,
        successRate: Math.round(successRate),
        avgCostUsd: Math.round(avgCostUsd * 10000) / 10000,
        totalCostUsd: Math.round(totalCostUsd * 10000) / 10000,
      },
      criticScores: {
        avgCorrectness: Math.round(avgCorrectness),
        avgEfficiency: Math.round(avgEfficiency),
        avgDrift: Math.round(avgDrift),
        approvedCount: withScores.filter(d => d.criticScore!.verdict === 'approved').length,
        needsRevisionCount: withScores.filter(d => d.criticScore!.verdict === 'needs-revision').length,
        rejectedCount: withScores.filter(d => d.criticScore!.verdict === 'rejected').length,
      },
      byRoute,
      recentTrend,
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Failed to compute analytics' }, { status: 500 })
  }
}
