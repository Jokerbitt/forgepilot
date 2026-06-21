export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'

export interface TokenStats {
  delegationId: string
  title: string
  status: string
  inputTokens: number
  outputTokens: number
  cachedTokens: number
  totalTokens: number
  costUsd: number | null
  cacheHitRate: number | null  // cachedTokens / (inputTokens + cachedTokens)
  retryCount: number
  createdAt: string
}

export interface TokenAnalytics {
  /** Top delegations by total token usage */
  topByTokens: TokenStats[]
  /** Totals across all tracked delegations */
  totals: {
    inputTokens: number
    outputTokens: number
    cachedTokens: number
    totalCostUsd: number
    delegationsTracked: number
    avgCacheHitRate: number | null
    avgTokensPerDelegation: number | null
  }
  /** Waste indicators */
  waste: {
    highRetryCount: TokenStats[]     // retried 2+ times (prompt inflation risk)
    lowCacheHit: TokenStats[]        // < 10% cache hit (no prompt caching benefit)
    topCostly: TokenStats[]          // most expensive runs
  }
}

export async function GET() {
  const authError = await requireAuth()
  if (authError) return authError

  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const all = await repo.listByStatus()

  // Only delegations with token data
  const tracked = all
    .filter(d => d.inputTokens != null || d.outputTokens != null)
    .map(d => {
      const inp = d.inputTokens ?? 0
      const out = d.outputTokens ?? 0
      const cached = d.cachedTokens ?? 0
      const total = inp + out
      const cacheHitRate = (inp + cached) > 0
        ? Math.round((cached / (inp + cached)) * 100)
        : null

      return {
        delegationId: d.id,
        title: d.title ?? d.contract.goal.slice(0, 60),
        status: d.status,
        inputTokens: inp,
        outputTokens: out,
        cachedTokens: cached,
        totalTokens: total,
        costUsd: d.actualCostUsd ?? null,
        cacheHitRate,
        retryCount: d.retryCount ?? 0,
        createdAt: d.createdAt,
      } satisfies TokenStats
    })
    .sort((a, b) => b.totalTokens - a.totalTokens)

  const totals = {
    inputTokens: tracked.reduce((s, d) => s + d.inputTokens, 0),
    outputTokens: tracked.reduce((s, d) => s + d.outputTokens, 0),
    cachedTokens: tracked.reduce((s, d) => s + d.cachedTokens, 0),
    totalCostUsd: tracked.reduce((s, d) => s + (d.costUsd ?? 0), 0),
    delegationsTracked: tracked.length,
    avgCacheHitRate: tracked.length > 0
      ? Math.round(tracked.reduce((s, d) => s + (d.cacheHitRate ?? 0), 0) / tracked.length)
      : null,
    avgTokensPerDelegation: tracked.length > 0
      ? Math.round(tracked.reduce((s, d) => s + d.totalTokens, 0) / tracked.length)
      : null,
  }

  const waste = {
    highRetryCount: tracked.filter(d => d.retryCount >= 2).slice(0, 5),
    lowCacheHit: tracked.filter(d => d.cacheHitRate !== null && d.cacheHitRate < 10).slice(0, 5),
    topCostly: [...tracked].sort((a, b) => (b.costUsd ?? 0) - (a.costUsd ?? 0)).slice(0, 5),
  }

  return NextResponse.json({
    topByTokens: tracked.slice(0, 10),
    totals,
    waste,
  } satisfies TokenAnalytics)
}
