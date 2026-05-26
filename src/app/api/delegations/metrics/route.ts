export const dynamic = 'force-dynamic'
/**
 * GET /api/delegations/metrics
 *
 * Aggregated performance + cost metrics across all delegations.
 * Designed for the M21 Cost & Performance Dashboard.
 */
import { NextResponse } from 'next/server'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import type { Delegation } from '@/lib/models/delegation'

export interface DelegationMetrics {
  totalCostUsd: number
  avgDurationMinutes: number
  successRate: number
  prMergeRate: number
  totalDelegations: number
  completedCount: number
  failedCount: number
  runningCount: number
  costByRoute: Record<string, number>
  avgCostByRoute: Record<string, number>
}

function delegationCost(d: Delegation): number {
  return d.actualCostUsd ?? d.costEstimateUsd ?? 0
}

function delegationDurationMinutes(d: Delegation): number {
  return d.summaryReport?.timeTakenMinutes ?? 0
}

export async function GET(): Promise<NextResponse> {
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const all = await repo.listByStatus()

  const completed = all.filter(d => d.status === 'completed')
  const failed    = all.filter(d => d.status === 'failed')
  const running   = all.filter(d => d.status === 'running')
  const terminal  = [...completed, ...failed]

  const totalCostUsd = all.reduce((s, d) => s + delegationCost(d), 0)
  const totalDuration = all.reduce((s, d) => s + delegationDurationMinutes(d), 0)
  const avgDurationMinutes = all.length > 0 ? Math.round(totalDuration / all.length) : 0
  const successRate = terminal.length > 0
    ? Math.round((completed.length / terminal.length) * 100)
    : 0

  const prCreated = all.filter(d => d.summaryReport?.prUrl).length
  const prMerged  = all.filter(d => d.summaryReport?.prState === 'merged').length
  const prMergeRate = prCreated > 0 ? Math.round((prMerged / prCreated) * 100) : 0

  // Aggregate cost and count by executionRoute
  const costByRouteMap = new Map<string, { total: number; count: number }>()
  for (const d of all) {
    const route = d.executionRoute ?? 'unknown'
    const existing = costByRouteMap.get(route) ?? { total: 0, count: 0 }
    costByRouteMap.set(route, {
      total: existing.total + delegationCost(d),
      count: existing.count + 1,
    })
  }

  const costByRoute: Record<string, number> = {}
  const avgCostByRoute: Record<string, number> = {}
  for (const [route, { total, count }] of costByRouteMap) {
    costByRoute[route] = Math.round(total * 10000) / 10000
    avgCostByRoute[route] = count > 0 ? Math.round((total / count) * 10000) / 10000 : 0
  }

  const metrics: DelegationMetrics = {
    totalCostUsd: Math.round(totalCostUsd * 10000) / 10000,
    avgDurationMinutes,
    successRate,
    prMergeRate,
    totalDelegations: all.length,
    completedCount: completed.length,
    failedCount: failed.length,
    runningCount: running.length,
    costByRoute,
    avgCostByRoute,
  }

  return NextResponse.json(metrics)
}
