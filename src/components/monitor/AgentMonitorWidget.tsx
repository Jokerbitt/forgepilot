'use client'

import { useEffect, useState, useCallback } from 'react'
import { Panel, cx } from '@/components/ui/primitives'

// ─── Types (minimal, matching MonitorSnapshot) ────────────────────────────────

interface AgentActivity {
  id: string
  name: string
  status: 'running' | 'completed' | 'failed' | 'idle'
  provider: string
  model: string
  purpose: 'fast' | 'coding'
  task?: string
  startedAt: string
  completedAt?: string
  durationMs?: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costUsd: number
}

interface ProviderStats {
  providerId: string
  providerName: string
  model: string
  callsToday: number
  freeQuotaUsed?: number
  freeQuotaLimit?: number
  costTodayUsd: number
}

interface MonitorSnapshot {
  timestamp: string
  activeAgents: AgentActivity[]
  recentAgents: AgentActivity[]
  providerStats: ProviderStats[]
  totals: {
    tokensToday: number
    costTodayUsd: number
    callsToday: number
    successRate: number
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCost(usd: number): string {
  if (usd === 0) return '$0.00'
  if (usd < 0.001) return `$${usd.toFixed(5)}`
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(3)}`
}

// ─── Mock fallback ────────────────────────────────────────────────────────────

const WIDGET_MOCK: MonitorSnapshot = {
  timestamp: new Date().toISOString(),
  activeAgents: [],
  recentAgents: [
    {
      id: 'demo-1',
      name: 'Idea Pipeline',
      status: 'completed',
      provider: 'google-gemini',
      model: 'gemini-2.0-flash',
      purpose: 'fast',
      startedAt: new Date(Date.now() - 45000).toISOString(),
      inputTokens: 620,
      outputTokens: 280,
      totalTokens: 900,
      costUsd: 0.000068,
    },
  ],
  providerStats: [
    {
      providerId: 'google-gemini',
      providerName: 'Google Gemini',
      model: 'gemini-2.0-flash',
      callsToday: 7,
      freeQuotaUsed: 7,
      freeQuotaLimit: 1500,
      costTodayUsd: 0.000405,
    },
  ],
  totals: {
    tokensToday: 5400,
    costTodayUsd: 0.000405,
    callsToday: 7,
    successRate: 1.0,
  },
}

// ─── Widget ───────────────────────────────────────────────────────────────────

export function AgentMonitorWidget() {
  const [snapshot, setSnapshot] = useState<MonitorSnapshot>(WIDGET_MOCK)

  const fetchSnapshot = useCallback(async () => {
    try {
      const res = await fetch('/api/monitor')
      if (!res.ok) return
      const data = await res.json() as MonitorSnapshot
      setSnapshot(data)
    } catch {
      // keep mock
    }
  }, [])

  useEffect(() => {
    void fetchSnapshot()
    const interval = window.setInterval(() => { void fetchSnapshot() }, 15000)
    return () => window.clearInterval(interval)
  }, [fetchSnapshot])

  const activeCount = snapshot.activeAgents.length
  const lastRun = snapshot.recentAgents[0]
  const primaryProvider = snapshot.providerStats[0]
  const hasQuota = primaryProvider?.freeQuotaLimit !== undefined && primaryProvider?.freeQuotaUsed !== undefined
  const quotaPct = hasQuota
    ? Math.round(((primaryProvider.freeQuotaUsed ?? 0) / (primaryProvider.freeQuotaLimit ?? 1)) * 100)
    : null

  const quotaBarColor = quotaPct !== null
    ? quotaPct >= 85 ? 'bg-rose-500' : quotaPct >= 60 ? 'bg-amber-400' : 'bg-emerald-500'
    : 'bg-emerald-500'

  return (
    <Panel className="p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">🤖</span>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Agent Monitor</p>
          {activeCount > 0 && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
          )}
        </div>
        <a
          href="/monitor"
          className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
        >
          → /monitor
        </a>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Active agents */}
        <div className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5">
          <p className={cx(
            'text-xl font-bold tabular-nums',
            activeCount > 0 ? 'text-emerald-400' : 'text-slate-500'
          )}>
            {activeCount}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-slate-600">Aktiv</p>
        </div>

        {/* Calls today */}
        <div className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5">
          <p className={cx(
            'text-xl font-bold tabular-nums',
            snapshot.totals.callsToday > 0 ? 'text-violet-400' : 'text-slate-500'
          )}>
            {snapshot.totals.callsToday}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-slate-600">Calls heute</p>
        </div>

        {/* Cost today */}
        <div className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5">
          <p className="text-base font-bold tabular-nums text-cyan-400">
            {formatCost(snapshot.totals.costTodayUsd)}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-slate-600">Kosten heute</p>
        </div>

        {/* Primary provider quota */}
        {primaryProvider && (
          <div className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5">
            <p className="text-xs font-semibold text-slate-300 truncate">{primaryProvider.providerName}</p>
            {hasQuota && quotaPct !== null ? (
              <p className="text-[10px] text-slate-500 tabular-nums">
                {primaryProvider.freeQuotaUsed}/{primaryProvider.freeQuotaLimit}
              </p>
            ) : (
              <p className="text-[10px] text-slate-600">kein Limit</p>
            )}
          </div>
        )}
      </div>

      {/* Quota bar */}
      {hasQuota && quotaPct !== null && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[10px]">
            <span className="text-slate-600">Free Quota {primaryProvider?.providerName}</span>
            <span className="font-mono text-slate-500">{quotaPct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className={cx('h-full rounded-full transition-all', quotaBarColor)}
              style={{ width: `${Math.min(quotaPct, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Last run */}
      {lastRun && (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-3 py-2">
          <div className="min-w-0 flex-1">
            <span className="text-[10px] text-slate-500">Letzter Run: </span>
            <span className="text-xs font-medium text-slate-300 truncate">&quot;{lastRun.name}&quot;</span>
          </div>
          <span className={cx(
            'ml-2 shrink-0 text-[10px] font-bold',
            lastRun.status === 'completed' ? 'text-emerald-400' :
            lastRun.status === 'failed' ? 'text-rose-400' : 'text-slate-500'
          )}>
            {lastRun.status === 'completed' ? '✓' : lastRun.status === 'failed' ? '✗' : '●'}
          </span>
        </div>
      )}
    </Panel>
  )
}
