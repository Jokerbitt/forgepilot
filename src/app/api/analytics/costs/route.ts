export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { readProcessingLedger } from '@/lib/dsgvo/processing-ledger'
import { readDelegations } from '@/lib/delegations/queue'
import { calculateCallCost } from '@/lib/delegations/cost-tracker'
import type { CostAnalytics } from '@/lib/analytics/cost-types'
import { buildCostReport } from '@/lib/analytics/cost-tracker'
import { apiLogger } from '@/lib/logger'

const DAYS = 30

/** Format ISO date to YYYY-MM-DD */
function toDateKey(iso: string): string {
  return iso.slice(0, 10)
}

/** Build a gap-filled array of the last N days */
function buildDateRange(days: number): string[] {
  const result: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - i)
    result.push(d.toISOString().slice(0, 10))
  }
  return result
}

export async function GET(): Promise<NextResponse> {
  try {
    const records = readProcessingLedger(2000)
    const delegations = readDelegations()

    // ── per-provider aggregation ──────────────────────────────────────
    const providerMap = new Map<string, {
      totalCostUsd: number; calls: number; inputTokens: number; outputTokens: number
      dataResidency: string
    }>()

    // ── per-purpose aggregation ───────────────────────────────────────
    const purposeMap = new Map<string, {
      totalCostUsd: number; calls: number; inputTokens: number; outputTokens: number
    }>()

    // ── daily trend ───────────────────────────────────────────────────
    const dateRange = buildDateRange(DAYS)
    const dailyMap = new Map<string, {
      totalCostUsd: number; calls: number; inputTokens: number; outputTokens: number
    }>()
    for (const d of dateRange) dailyMap.set(d, { totalCostUsd: 0, calls: 0, inputTokens: 0, outputTokens: 0 })

    let totalCostUsd = 0
    let totalInputTokens = 0
    let totalOutputTokens = 0

    for (const rec of records) {
      const providerId = rec.providerId ?? 'unknown'
      const inputTokens = rec.inputTokens ?? 0
      const outputTokens = 0 // ProcessingRecord has no outputTokens field
      const costBreakdown = calculateCallCost({ inputTokens, outputTokens, providerId, modelId: '' })
      const callCost = costBreakdown.totalCostUsd

      totalCostUsd += callCost
      totalInputTokens += inputTokens
      totalOutputTokens += outputTokens

      // provider
      const pv = providerMap.get(providerId) ?? { totalCostUsd: 0, calls: 0, inputTokens: 0, outputTokens: 0, dataResidency: rec.dataResidency ?? 'unknown' }
      pv.totalCostUsd += callCost
      pv.calls += 1
      pv.inputTokens += inputTokens
      pv.outputTokens += outputTokens
      providerMap.set(providerId, pv)

      // purpose
      const purpose = rec.purpose ?? 'unknown'
      const pu = purposeMap.get(purpose) ?? { totalCostUsd: 0, calls: 0, inputTokens: 0, outputTokens: 0 }
      pu.totalCostUsd += callCost
      pu.calls += 1
      pu.inputTokens += inputTokens
      pu.outputTokens += outputTokens
      purposeMap.set(purpose, pu)

      // daily trend (only last 30 days)
      const dateKey = toDateKey(rec.processedAt)
      const dv = dailyMap.get(dateKey)
      if (dv) {
        dv.totalCostUsd += callCost
        dv.calls += 1
        dv.inputTokens += inputTokens
        dv.outputTokens += outputTokens
      }
    }

    // ── budget utilization ────────────────────────────────────────────
    let delegationsWithBudget = 0
    let delegationsExceeded = 0
    for (const d of delegations) {
      if (d.contract.maxBudgetUsd != null && d.contract.maxBudgetUsd > 0) {
        delegationsWithBudget++
        const actual = d.actualCostUsd ?? 0
        if (actual > d.contract.maxBudgetUsd) delegationsExceeded++
      }
    }
    const utilizationPct = delegationsWithBudget > 0
      ? Math.round((delegationsExceeded / delegationsWithBudget) * 100)
      : 0

    // ── estimated monthly cost ────────────────────────────────────────
    // Sum costs from last 30 days and project to 30 days
    const last30DaysCost = Array.from(dailyMap.values()).reduce((s, d) => s + d.totalCostUsd, 0)
    const estimatedMonthlyCostUsd = last30DaysCost // already 30 days

    const analytics: CostAnalytics = {
      totals: {
        costUsd: totalCostUsd,
        calls: records.length,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        estimatedMonthlyCostUsd,
      },
      byProvider: Array.from(providerMap.entries()).map(([id, v]) => ({
        providerId: id,
        providerName: id.charAt(0).toUpperCase() + id.slice(1),
        dataResidency: (v.dataResidency as 'eu' | 'us' | 'local' | 'unknown') ?? 'unknown',
        totalCostUsd: v.totalCostUsd,
        calls: v.calls,
        inputTokens: v.inputTokens,
        outputTokens: v.outputTokens,
      })).sort((a, b) => b.totalCostUsd - a.totalCostUsd),
      byPurpose: Array.from(purposeMap.entries()).map(([purpose, v]) => ({
        purpose,
        totalCostUsd: v.totalCostUsd,
        calls: v.calls,
        inputTokens: v.inputTokens,
        outputTokens: v.outputTokens,
      })).sort((a, b) => b.totalCostUsd - a.totalCostUsd),
      dailyTrend: dateRange.map(d => {
        const v = dailyMap.get(d) ?? { totalCostUsd: 0, calls: 0, inputTokens: 0, outputTokens: 0 }
        return { date: d, ...v }
      }),
      budgetUtilization: {
        delegationsWithBudget,
        delegationsExceeded,
        utilizationPct,
      },
    }

    // M159: provider cost report (executionRoute breakdown + Ollama savings)
    const providerSavings = buildCostReport()

    return NextResponse.json({ ...analytics, providerSavings })
  } catch (err) {
    apiLogger.error({ event: 'analytics.costs.error', err }, 'Failed to compute cost analytics')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
