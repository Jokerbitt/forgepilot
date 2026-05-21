/**
 * Provider Cost Tracker — M159
 *
 * Aggregates token usage and cost from completed delegations.
 * Groups by executionRoute → maps to provider.
 * No external calls — reads existing delegations.json store.
 *
 * Fields used per delegation:
 *   - executionRoute           → provider key
 *   - actualCostUsd            → billed cost (0 for Ollama)
 *   - summaryReport.costSavings → tokens, cloud-equivalent, savings
 */

import fs from 'fs'
import path from 'path'
import type { Delegation } from '@/lib/models/delegation'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProviderCostEntry {
  /** executionRoute value, e.g. "ollama-agent", "direct-chat", "runner" */
  providerId: string
  /** Number of completed delegations on this route */
  delegationCount: number
  /** Sum of actualCostUsd across all completed delegations */
  totalCostUsd: number
  /** Sum of cloud-equivalent cost (what it would cost without savings) */
  cloudEquivalentUsd: number
  /** Sum of savedUsd (0 for cloud providers, savings for local) */
  totalSavedUsd: number
  /** Total input + output tokens */
  totalTokens: number
  /** Most recently used model on this route */
  lastModel: string | null
  /** Cost trend — last 7d vs previous 7d (positive = more expensive this week) */
  costTrend7d: number | null
}

export interface CostReport {
  generatedAt: string
  entries: ProviderCostEntry[]
  totals: {
    delegationCount: number
    totalCostUsd: number
    cloudEquivalentUsd: number
    totalSavedUsd: number
    totalTokens: number
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

const DELEGATIONS_FILE = path.join(process.cwd(), 'config', 'delegations.json')

function readDelegations(): Delegation[] {
  try {
    return JSON.parse(fs.readFileSync(DELEGATIONS_FILE, 'utf-8')) as Delegation[]
  } catch {
    return []
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build a cost report from all completed delegations.
 * Only `completed` status delegations contribute to cost totals.
 */
export function buildCostReport(now = new Date()): CostReport {
  const delegations = readDelegations()
  const completed = delegations.filter(d => d.status === 'completed')

  const byRoute = new Map<string, {
    count: number
    costUsd: number
    cloudEquivUsd: number
    savedUsd: number
    tokens: number
    lastModel: string | null
    last7d: number
    prev7d: number
  }>()

  const msIn7d = 7 * 24 * 60 * 60 * 1000
  const cutoff7d = now.getTime() - msIn7d
  const cutoffPrev = cutoff7d - msIn7d

  for (const d of completed) {
    const route = d.executionRoute ?? 'unknown'
    if (!byRoute.has(route)) {
      byRoute.set(route, { count: 0, costUsd: 0, cloudEquivUsd: 0, savedUsd: 0, tokens: 0, lastModel: null, last7d: 0, prev7d: 0 })
    }
    const entry = byRoute.get(route)!
    const cs = d.summaryReport?.costSavings

    entry.count++
    entry.costUsd       += d.actualCostUsd ?? 0
    entry.cloudEquivUsd += cs?.cloudEquivalentUsd ?? cs?.claudeEquivalentUsd ?? (d.actualCostUsd ?? 0)
    entry.savedUsd      += cs?.savedUsd ?? 0
    entry.tokens        += (cs?.inputTokens ?? cs?.tokensUsed?.promptTokens ?? 0)
                         + (cs?.outputTokens ?? cs?.tokensUsed?.completionTokens ?? 0)
    if (cs?.localModel ?? d.contract?.llmModel) {
      entry.lastModel = cs?.localModel ?? d.contract?.llmModel ?? null
    }

    const updatedMs = new Date(d.updatedAt ?? d.createdAt).getTime()
    if (updatedMs >= cutoff7d) {
      entry.last7d += d.actualCostUsd ?? 0
    } else if (updatedMs >= cutoffPrev) {
      entry.prev7d += d.actualCostUsd ?? 0
    }
  }

  const entries: ProviderCostEntry[] = Array.from(byRoute.entries()).map(([route, e]) => ({
    providerId:        route,
    delegationCount:   e.count,
    totalCostUsd:      Math.round(e.costUsd * 10_000) / 10_000,
    cloudEquivalentUsd: Math.round(e.cloudEquivUsd * 10_000) / 10_000,
    totalSavedUsd:     Math.round(e.savedUsd * 10_000) / 10_000,
    totalTokens:       e.tokens,
    lastModel:         e.lastModel,
    costTrend7d:       e.prev7d > 0
      ? Math.round((e.last7d - e.prev7d) / e.prev7d * 100)
      : null,
  })).sort((a, b) => b.totalCostUsd + b.totalSavedUsd - (a.totalCostUsd + a.totalSavedUsd))

  const totals = entries.reduce(
    (acc, e) => ({
      delegationCount:   acc.delegationCount   + e.delegationCount,
      totalCostUsd:      acc.totalCostUsd      + e.totalCostUsd,
      cloudEquivalentUsd: acc.cloudEquivalentUsd + e.cloudEquivalentUsd,
      totalSavedUsd:     acc.totalSavedUsd     + e.totalSavedUsd,
      totalTokens:       acc.totalTokens       + e.totalTokens,
    }),
    { delegationCount: 0, totalCostUsd: 0, cloudEquivalentUsd: 0, totalSavedUsd: 0, totalTokens: 0 },
  )

  return {
    generatedAt: now.toISOString(),
    entries,
    totals: {
      ...totals,
      totalCostUsd:      Math.round(totals.totalCostUsd * 10_000) / 10_000,
      cloudEquivalentUsd: Math.round(totals.cloudEquivalentUsd * 10_000) / 10_000,
      totalSavedUsd:     Math.round(totals.totalSavedUsd * 10_000) / 10_000,
    },
  }
}

/** Format cost as currency string, e.g. "$0.0023" or "< $0.01" */
export function formatCostCompact(usd: number): string {
  if (usd === 0) return '$0'
  if (usd < 0.01) return '< $0.01'
  if (usd < 1) return `$${usd.toFixed(3)}`
  return `$${usd.toFixed(2)}`
}

/** Format token count as compact string, e.g. "1.2K", "3.4M" */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}
