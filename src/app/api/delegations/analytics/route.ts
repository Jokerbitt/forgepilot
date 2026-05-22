export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import type { Delegation } from '@/lib/models/delegation'
import type { RiskClass } from '@/lib/models/work-item'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DailyBucket {
  date: string
  count: number
  costUsd: number
  successRate: number
}

interface RiskClassMetrics {
  total: number
  completed: number
  failed: number
  successRate: number
  avgDurationMinutes: number
  avgCostUsd: number
  retried: number
}

export interface DelegationAnalytics {
  period: { from: string; to: string; days: number }
  costTrend: DailyBucket[]
  byRiskClass: Record<RiskClass, RiskClassMetrics>
  topFailureReasons: Array<{ reason: string; count: number }>
  avgDurationMinutes: number
  criticRetryStats: {
    total: number
    triggered: number
    successAfterRetry: number
    triggerRate: number
  }
  executionRouteBreakdown: Record<string, number>
  totalCostUsd: number
  successRate: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateKey(iso: string): string {
  return iso.slice(0, 10)
}

function durationMinutes(d: Delegation): number {
  if (!d.summaryReport?.timeTakenMinutes) return 0
  return d.summaryReport.timeTakenMinutes
}

function isCompleted(d: Delegation) { return d.status === 'completed' }
function isFailed(d: Delegation)    { return d.status === 'failed' }
function isTerminal(d: Delegation)  { return isCompleted(d) || isFailed(d) }

// ─── Route ───────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const url = new URL(request.url)
  const days = Math.min(90, Math.max(7, Number(url.searchParams.get('days') ?? '30')))

  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const all  = await repo.listByStatus()

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffIso = cutoff.toISOString()

  const inPeriod = all.filter(d => d.createdAt >= cutoffIso)

  // ── Cost trend (daily buckets) ─────────────────────────────────────────────
  const buckets = new Map<string, { count: number; costUsd: number; completed: number; total: number }>()
  for (const d of inPeriod) {
    const key = toDateKey(d.createdAt)
    const b   = buckets.get(key) ?? { count: 0, costUsd: 0, completed: 0, total: 0 }
    b.count++
    b.costUsd += d.actualCostUsd ?? d.costEstimateUsd ?? 0
    if (isTerminal(d)) {
      b.total++
      if (isCompleted(d)) b.completed++
    }
    buckets.set(key, b)
  }
  const costTrend: DailyBucket[] = Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, b]) => ({
      date,
      count: b.count,
      costUsd: Math.round(b.costUsd * 1000) / 1000,
      successRate: b.total > 0 ? Math.round((b.completed / b.total) * 100) : 0,
    }))

  // ── By risk class ──────────────────────────────────────────────────────────
  const riskClasses: RiskClass[] = ['A', 'B', 'C']
  const byRiskClass = {} as Record<RiskClass, RiskClassMetrics>

  for (const rc of riskClasses) {
    const group = inPeriod.filter(d => d.contract.riskClass === rc)
    const terminal = group.filter(isTerminal)
    const completed = group.filter(isCompleted)
    const failed = group.filter(isFailed)
    const retried = group.filter(d => (d.retryCount ?? 0) > 0)
    const totalDuration = group.reduce((acc, d) => acc + durationMinutes(d), 0)
    const totalCost = group.reduce((acc, d) => acc + (d.actualCostUsd ?? d.costEstimateUsd ?? 0), 0)

    byRiskClass[rc] = {
      total: group.length,
      completed: completed.length,
      failed: failed.length,
      successRate: terminal.length > 0 ? Math.round((completed.length / terminal.length) * 100) : 0,
      avgDurationMinutes: group.length > 0 ? Math.round(totalDuration / group.length) : 0,
      avgCostUsd: group.length > 0 ? Math.round((totalCost / group.length) * 1000) / 1000 : 0,
      retried: retried.length,
    }
  }

  // ── Failure reasons (top 5) ────────────────────────────────────────────────
  const failureCountMap = new Map<string, number>()
  for (const d of inPeriod.filter(isFailed)) {
    const lastError = d.logs?.filter(l => l.type === 'error').at(-1)?.message
    const reason = lastError
      ? lastError.slice(0, 80)
      : 'Unknown error'
    failureCountMap.set(reason, (failureCountMap.get(reason) ?? 0) + 1)
  }
  const topFailureReasons = Array.from(failureCountMap.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([reason, count]) => ({ reason, count }))

  // ── Critic retry stats ─────────────────────────────────────────────────────
  const retriedDelegations = inPeriod.filter(d => d.chainedFromId)
  const successAfterRetry = retriedDelegations.filter(isCompleted)
  const totalTerminal = inPeriod.filter(isTerminal)

  // ── Execution route breakdown ──────────────────────────────────────────────
  const routeMap = new Map<string, number>()
  for (const d of inPeriod) {
    const route = d.executionRoute ?? 'unknown'
    routeMap.set(route, (routeMap.get(route) ?? 0) + 1)
  }

  // ── Global metrics ─────────────────────────────────────────────────────────
  const totalDuration = inPeriod.reduce((acc, d) => acc + durationMinutes(d), 0)
  const totalCost = inPeriod.reduce((acc, d) => acc + (d.actualCostUsd ?? d.costEstimateUsd ?? 0), 0)
  const completedInPeriod = inPeriod.filter(isCompleted)

  const analytics: DelegationAnalytics = {
    period: {
      from: cutoffIso.slice(0, 10),
      to:   new Date().toISOString().slice(0, 10),
      days,
    },
    costTrend,
    byRiskClass,
    topFailureReasons,
    avgDurationMinutes: inPeriod.length > 0 ? Math.round(totalDuration / inPeriod.length) : 0,
    criticRetryStats: {
      total: retriedDelegations.length,
      triggered: inPeriod.filter(d => (d.retryCount ?? 0) > 0).length,
      successAfterRetry: successAfterRetry.length,
      triggerRate: totalTerminal.length > 0
        ? Math.round((retriedDelegations.length / totalTerminal.length) * 100)
        : 0,
    },
    executionRouteBreakdown: Object.fromEntries(routeMap),
    totalCostUsd: Math.round(totalCost * 1000) / 1000,
    successRate: totalTerminal.length > 0
      ? Math.round((completedInPeriod.length / totalTerminal.length) * 100)
      : 0,
  }

  return NextResponse.json(analytics)
}
