'use client'

import { useEffect, useState, useCallback } from 'react'
import { Panel, StatusDot, Badge, buttonClassName, cx } from '@/components/ui/primitives'

// ─── Types ────────────────────────────────────────────────────────────────────

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
  runId?: string
}

interface ProviderStats {
  providerId: string
  providerName: string
  model: string
  callsToday: number
  callsTotal: number
  tokensToday: number
  tokensTotal: number
  costTodayUsd: number
  costTotalUsd: number
  avgLatencyMs: number
  errorRate: number
  freeQuotaUsed?: number
  freeQuotaLimit?: number
}

interface MonitorRecommendation {
  type: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  description: string
  action?: string
}

interface MonitorSnapshot {
  timestamp: string
  activeAgents: AgentActivity[]
  recentAgents: AgentActivity[]
  providerStats: ProviderStats[]
  recommendations: MonitorRecommendation[]
  totals: {
    tokensToday: number
    costTodayUsd: number
    costThisMonthUsd: number
    callsToday: number
    avgResponseMs: number
    successRate: number
  }
}

// ─── Mock fallback data ────────────────────────────────────────────────────────

const MOCK: MonitorSnapshot = {
  timestamp: new Date().toISOString(),
  activeAgents: [],
  recentAgents: [
    {
      id: 'demo-1',
      name: 'Idea → Brief Pipeline',
      status: 'completed',
      provider: 'google-gemini',
      model: 'gemini-2.0-flash',
      purpose: 'fast',
      task: 'Idee analysiert und strukturiert',
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
      callsTotal: 47,
      tokensToday: 5400,
      tokensTotal: 32100,
      costTodayUsd: 0.000405,
      costTotalUsd: 0.002408,
      avgLatencyMs: 1180,
      errorRate: 0,
      freeQuotaUsed: 7,
      freeQuotaLimit: 1500,
    },
    {
      providerId: 'together',
      providerName: 'Together.ai',
      model: 'Llama 3.3 70B',
      callsToday: 0,
      callsTotal: 3,
      tokensToday: 0,
      tokensTotal: 2700,
      costTodayUsd: 0,
      costTotalUsd: 0.00237,
      avgLatencyMs: 890,
      errorRate: 0,
    },
  ],
  recommendations: [
    {
      type: 'info',
      severity: 'info',
      title: 'Alles im gruenen Bereich',
      description: 'Gemini Free Tier: 7 / 1.500 Calls heute. Together.ai als Backup aktiv.',
    },
  ],
  totals: {
    tokensToday: 5400,
    costTodayUsd: 0.000405,
    costThisMonthUsd: 0.002813,
    callsToday: 7,
    avgResponseMs: 1180,
    successRate: 1.0,
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function formatCost(usd: number): string {
  if (usd === 0) return '$0.00'
  if (usd < 0.001) return `$${usd.toFixed(6)}`
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(3)}`
}

function formatDuration(ms?: number): string {
  if (!ms) return '—'
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return `vor ${diffSec}s`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `vor ${diffMin} Min`
  const diffH = Math.floor(diffMin / 60)
  return `vor ${diffH}h`
}

function getProviderColor(id: string): { dot: string; badge: string; border: string; accent: string } {
  if (id.includes('gemini') || id.includes('google')) {
    return {
      dot: 'bg-blue-400',
      badge: 'bg-blue-500/10 text-blue-300 border-blue-500/25',
      border: 'border-blue-500/30',
      accent: 'text-blue-300',
    }
  }
  if (id.includes('together') || id.includes('llama')) {
    return {
      dot: 'bg-violet-400',
      badge: 'bg-violet-500/10 text-violet-300 border-violet-500/25',
      border: 'border-violet-500/30',
      accent: 'text-violet-300',
    }
  }
  if (id.includes('ollama') || id.includes('local')) {
    return {
      dot: 'bg-emerald-400',
      badge: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
      border: 'border-emerald-500/30',
      accent: 'text-emerald-300',
    }
  }
  if (id.includes('openai') || id.includes('gpt')) {
    return {
      dot: 'bg-teal-400',
      badge: 'bg-teal-500/10 text-teal-300 border-teal-500/25',
      border: 'border-teal-500/30',
      accent: 'text-teal-300',
    }
  }
  return {
    dot: 'bg-slate-400',
    badge: 'bg-slate-500/10 text-slate-300 border-slate-500/25',
    border: 'border-slate-700',
    accent: 'text-slate-400',
  }
}

function getQuotaColor(used: number, limit: number): string {
  const pct = (used / limit) * 100
  if (pct >= 85) return 'bg-rose-500'
  if (pct >= 60) return 'bg-amber-400'
  return 'bg-emerald-500'
}

function getStatusDotTone(status: AgentActivity['status']): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'running') return 'success'
  if (status === 'idle') return 'warning'
  if (status === 'failed') return 'danger'
  return 'neutral'
}

function getStatusBadgeTone(status: AgentActivity['status']): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'completed') return 'success'
  if (status === 'running') return 'info' as unknown as 'success'
  if (status === 'failed') return 'danger'
  return 'neutral'
}

function statusLabel(status: AgentActivity['status']): string {
  if (status === 'running') return 'Laeuft'
  if (status === 'completed') return 'Fertig'
  if (status === 'failed') return 'Fehler'
  return 'Idle'
}

function severityBg(severity: MonitorRecommendation['severity']): string {
  if (severity === 'critical') return 'bg-rose-500/10 border-rose-500/30'
  if (severity === 'warning') return 'bg-amber-500/10 border-amber-500/30'
  return 'bg-blue-500/10 border-blue-500/20'
}

function severityIcon(severity: MonitorRecommendation['severity']): string {
  if (severity === 'critical') return '🚨'
  if (severity === 'warning') return '⚠️'
  return 'ℹ️'
}

function severityText(severity: MonitorRecommendation['severity']): string {
  if (severity === 'critical') return 'text-rose-300'
  if (severity === 'warning') return 'text-amber-300'
  return 'text-blue-300'
}

// ─── Gemini Quota ─────────────────────────────────────────────────────────────

interface GeminiQuotaStatus {
  today: number
  limit: number
  percentage: number
  resetAt: string
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MonitorPage() {
  const [snapshot, setSnapshot] = useState<MonitorSnapshot>(MOCK)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [isLive, setIsLive] = useState(false)
  const [useMock, setUseMock] = useState(true)
  const [geminiQuota, setGeminiQuota] = useState<GeminiQuotaStatus | null>(null)

  const fetchGeminiQuota = useCallback(async () => {
    try {
      const res = await fetch('/api/monitor/quota')
      if (!res.ok) return
      setGeminiQuota(await res.json() as GeminiQuotaStatus)
    } catch { /* quota endpoint not yet available */ }
  }, [])

  const fetchSnapshot = useCallback(async () => {
    try {
      const res = await fetch('/api/monitor')
      if (!res.ok) throw new Error('not ok')
      const data = await res.json() as MonitorSnapshot
      setSnapshot(data)
      setUseMock(false)
      setIsLive((data.activeAgents?.length ?? 0) > 0)
    } catch {
      // API not yet built — keep mock data
      setSnapshot(prev => ({ ...prev, timestamp: new Date().toISOString() }))
      setUseMock(true)
    }
    setLastRefresh(new Date())
  }, [])

  useEffect(() => {
    void fetchSnapshot()
    void fetchGeminiQuota()
    const interval = window.setInterval(() => {
      void fetchSnapshot()
      void fetchGeminiQuota()
    }, 30000)
    return () => window.clearInterval(interval)
  }, [fetchSnapshot, fetchGeminiQuota])

  const hasActive = snapshot.activeAgents.length > 0
  const recentSlice = snapshot.recentAgents.slice(0, 10)

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl p-6 space-y-6">

        {/* ── Header ── */}
        <header className="mb-2 border-b border-slate-800 pb-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Operate</p>
              <h1 className="mt-2 flex items-center gap-3 text-3xl font-semibold tracking-tight">
                🤖 Agent Monitor
                {hasActive && (
                  <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
                  </span>
                )}
              </h1>
              <p className="mt-1.5 text-sm text-slate-400">
                Live-Ueberwachung aller Agenten, Provider-Limits und Kosten.
                {useMock && <span className="ml-2 text-xs text-amber-400">(Demo-Daten — /api/monitor nicht aktiv)</span>}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { void fetchSnapshot() }}
                className={buttonClassName('ghost', 'text-xs')}
              >
                ↻ Refresh
              </button>
              <span className="text-xs text-slate-600">
                {formatRelativeTime(lastRefresh.toISOString())}
              </span>
            </div>
          </div>
        </header>

        {/* ── Sektion 1: Aktive Agents ── */}
        <Panel className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Live</p>
              <h2 className="mt-1 text-lg font-semibold text-white">Aktive Agenten</h2>
            </div>
            {hasActive && (
              <Badge tone="success">{snapshot.activeAgents.length} aktiv</Badge>
            )}
          </div>

          {!hasActive ? (
            <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-800 bg-slate-900/40 px-6 py-10 text-center">
              <div>
                <p className="text-2xl">😴</p>
                <p className="mt-2 text-sm font-semibold text-slate-400">Kein Agent aktiv — alles ruhig</p>
                <p className="mt-1 text-xs text-slate-600">Agenten erscheinen hier sobald eine Delegation gestartet wird.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {snapshot.activeAgents.map(agent => (
                <ActiveAgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          )}
        </Panel>

        {/* ── Sektion 2: Provider Stats ── */}
        {snapshot.providerStats.length > 0 && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Provider</p>
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                {snapshot.providerStats.length}
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {snapshot.providerStats.map(provider => (
                <ProviderCard key={provider.providerId} stats={provider} />
              ))}
            </div>
          </div>
        )}

        {/* ── Sektion 2b: Gemini Free Tier Quota ── */}
        <GeminiQuotaWidget quota={geminiQuota} />

        {/* ── Sektion 3: Empfehlungen ── */}
        {snapshot.recommendations.length > 0 && (
          <Panel className="p-5">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Empfehlungen</p>
              <h2 className="mt-1 text-lg font-semibold text-white">Hinweise & Aktionen</h2>
            </div>
            <div className="space-y-3">
              {snapshot.recommendations.map((rec, i) => (
                <div
                  key={i}
                  className={cx('flex items-start gap-3 rounded-lg border px-4 py-3', severityBg(rec.severity))}
                >
                  <span className="mt-0.5 shrink-0 text-base">{severityIcon(rec.severity)}</span>
                  <div className="flex-1 min-w-0">
                    <p className={cx('text-sm font-semibold', severityText(rec.severity))}>{rec.title}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{rec.description}</p>
                  </div>
                  {rec.action && (
                    <button className={buttonClassName('ghost', 'shrink-0 text-xs')}>
                      {rec.action}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        )}

        {/* ── Sektion 4: Verlauf ── */}
        <Panel className="overflow-hidden p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Verlauf</p>
              <h2 className="mt-1 text-lg font-semibold text-white">Letzte Runs</h2>
            </div>
            <a href="/agent-runs" className={buttonClassName('ghost', 'text-xs')}>Alle Runs →</a>
          </div>

          {recentSlice.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-600">Noch keine Runs aufgezeichnet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="pb-2 pr-4">Zeit</th>
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4 hidden sm:table-cell">Modell</th>
                    <th className="pb-2 pr-4 text-right">Tokens</th>
                    <th className="pb-2 pr-4 text-right">Kosten</th>
                    <th className="pb-2 pr-4 text-right hidden md:table-cell">Dauer</th>
                    <th className="pb-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {recentSlice.map(agent => (
                    <tr key={agent.id} className="hover:bg-slate-800/20">
                      <td className="py-2.5 pr-4 text-slate-500 whitespace-nowrap">
                        {formatRelativeTime(agent.startedAt)}
                      </td>
                      <td className="py-2.5 pr-4 max-w-[180px]">
                        <p className="truncate font-medium text-slate-200">{agent.name}</p>
                        {agent.task && (
                          <p className="truncate text-slate-600 italic">{agent.task}</p>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 text-slate-400 hidden sm:table-cell whitespace-nowrap">
                        {agent.model}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono text-slate-400 tabular-nums">
                        {formatTokens(agent.totalTokens)}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono text-slate-400 tabular-nums">
                        {formatCost(agent.costUsd)}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-slate-500 hidden md:table-cell">
                        {formatDuration(agent.durationMs)}
                      </td>
                      <td className="py-2.5 text-center">
                        <RunStatusBadge status={agent.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {/* ── Sektion 5: Monats-Summary ── */}
        <Panel className="p-5">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Uebersicht</p>
            <h2 className="mt-1 text-lg font-semibold text-white">Heute & Diesen Monat</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryMetric
              label="Calls heute"
              value={String(snapshot.totals.callsToday)}
              sub="API-Aufrufe (24h)"
              color={snapshot.totals.callsToday > 0 ? 'text-violet-400' : 'text-slate-500'}
            />
            <SummaryMetric
              label="Tokens heute"
              value={formatTokens(snapshot.totals.tokensToday)}
              sub="Input + Output"
              color={snapshot.totals.tokensToday > 0 ? 'text-blue-400' : 'text-slate-500'}
            />
            <SummaryMetric
              label="Kosten Monat"
              value={formatCost(snapshot.totals.costThisMonthUsd)}
              sub="laufender Monat"
              color="text-cyan-400"
            />
            <SummaryMetric
              label="Erfolgsrate"
              value={`${Math.round(snapshot.totals.successRate * 100)}%`}
              sub={`Ø ${Math.round(snapshot.totals.avgResponseMs)}ms Latenz`}
              color={snapshot.totals.successRate >= 0.9 ? 'text-emerald-400' : snapshot.totals.successRate >= 0.7 ? 'text-amber-400' : 'text-rose-400'}
            />
          </div>
        </Panel>

      </div>
    </main>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ActiveAgentCard({ agent }: { agent: AgentActivity }) {
  const elapsed = Date.now() - new Date(agent.startedAt).getTime()
  const isRunning = agent.status === 'running'

  return (
    <div className={cx(
      'rounded-lg border px-4 py-3',
      isRunning
        ? 'border-emerald-500/30 bg-emerald-950/20'
        : 'border-slate-800 bg-slate-900/40'
    )}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          <StatusDot tone={getStatusDotTone(agent.status)} pulse={isRunning} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-white text-sm">{agent.name}</span>
            <span className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-300">
              {agent.model} · {agent.purpose}
            </span>
          </div>
          {agent.task && (
            <p className="mt-1 text-xs italic text-slate-500">{agent.task}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>{formatRelativeTime(agent.startedAt)}</span>
            <span>·</span>
            <span>{formatTokens(agent.totalTokens)} tokens</span>
            <span>·</span>
            <span className="text-cyan-400">{formatCost(agent.costUsd)}</span>
            {isRunning && (
              <>
                <span>·</span>
                <span className="tabular-nums">{Math.round(elapsed / 1000)}s</span>
              </>
            )}
          </div>
        </div>
      </div>
      {isRunning && (
        <div className="mt-3">
          <div className="h-1 w-full overflow-hidden rounded-full bg-slate-800">
            <div className="h-1 w-full rounded-full bg-emerald-500 animate-[progress_2s_ease-in-out_infinite]"
              style={{ width: '60%', animation: 'pulse 1.5s ease-in-out infinite' }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function ProviderCard({ stats }: { stats: ProviderStats }) {
  const colors = getProviderColor(stats.providerId)
  const hasQuota = stats.freeQuotaLimit !== undefined && stats.freeQuotaUsed !== undefined
  const quotaPct = hasQuota
    ? Math.round(((stats.freeQuotaUsed ?? 0) / (stats.freeQuotaLimit ?? 1)) * 100)
    : 0

  return (
    <div className={cx('rounded-xl border p-4', colors.border, 'bg-white/[0.02]')}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className={cx('h-2.5 w-2.5 rounded-full shrink-0', colors.dot)} />
          <span className={cx('text-sm font-semibold', colors.accent)}>{stats.providerName}</span>
        </div>
        <span className="text-[10px] font-mono text-slate-600">{stats.avgLatencyMs}ms Ø</span>
      </div>

      {/* Model */}
      <div className="mb-3">
        <span className="rounded border border-slate-700 bg-slate-800/60 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
          {stats.model}
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded bg-slate-900/60 px-2 py-1.5 text-center">
          <p className={cx('text-base font-bold tabular-nums', stats.callsToday > 0 ? colors.accent : 'text-slate-500')}>
            {stats.callsToday}
          </p>
          <p className="text-[9px] uppercase tracking-wide text-slate-600">Calls h.</p>
        </div>
        <div className="rounded bg-slate-900/60 px-2 py-1.5 text-center">
          <p className={cx('text-base font-bold tabular-nums', stats.tokensToday > 0 ? 'text-slate-200' : 'text-slate-500')}>
            {formatTokens(stats.tokensToday)}
          </p>
          <p className="text-[9px] uppercase tracking-wide text-slate-600">Tokens h.</p>
        </div>
        <div className="rounded bg-slate-900/60 px-2 py-1.5 text-center">
          <p className={cx('text-base font-bold tabular-nums', stats.costTodayUsd > 0 ? 'text-cyan-400' : 'text-slate-500')}>
            {formatCost(stats.costTodayUsd)}
          </p>
          <p className="text-[9px] uppercase tracking-wide text-slate-600">Kosten h.</p>
        </div>
      </div>

      {/* Free Quota bar */}
      {hasQuota && (
        <div>
          <div className="mb-1 flex items-center justify-between text-[10px]">
            <span className="text-slate-500">Free Quota</span>
            <span className="font-mono text-slate-400 tabular-nums">
              {stats.freeQuotaUsed} / {stats.freeQuotaLimit} ({quotaPct}%)
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className={cx('h-full rounded-full transition-all', getQuotaColor(stats.freeQuotaUsed ?? 0, stats.freeQuotaLimit ?? 1))}
              style={{ width: `${Math.min(quotaPct, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Error rate */}
      {stats.errorRate > 0 && (
        <div className="mt-2 text-[10px] text-rose-400">
          Fehlerrate: {Math.round(stats.errorRate * 100)}%
        </div>
      )}
    </div>
  )
}

function RunStatusBadge({ status }: { status: AgentActivity['status'] }) {
  const colors = {
    running: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
    completed: 'bg-slate-700/40 text-slate-300 border-slate-600/30',
    failed: 'bg-rose-500/15 text-rose-300 border-rose-500/25',
    idle: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
  }
  return (
    <span className={cx('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold', colors[status])}>
      {statusLabel(status)}
    </span>
  )
}

function SummaryMetric({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={cx('mt-1.5 text-2xl font-bold tabular-nums', color ?? 'text-white')}>{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-slate-600">{sub}</p>}
    </div>
  )
}

// ─── Gemini Quota Widget ──────────────────────────────────────────────────────

function GeminiQuotaWidget({ quota }: { quota: GeminiQuotaStatus | null }) {
  const today = quota?.today ?? 0
  const limit = quota?.limit ?? 1500
  const percentage = quota?.percentage ?? 0
  const resetAt = quota?.resetAt ?? ''

  const barColor =
    percentage >= 95 ? 'bg-rose-500' : percentage >= 80 ? 'bg-amber-400' : 'bg-emerald-500'

  const textColor =
    percentage >= 95 ? 'text-rose-300' : percentage >= 80 ? 'text-amber-300' : 'text-emerald-300'

  const filledBlocks = Math.round((percentage / 100) * 14)
  const emptyBlocks = 14 - filledBlocks
  const bar = '\u2588'.repeat(filledBlocks) + '\u2591'.repeat(emptyBlocks)

  const resetLabel = resetAt
    ? `T\u00e4gl. Reset: ${new Date(resetAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })} 00:00 UTC`
    : 'T\u00e4gl. Reset: morgen 00:00 UTC'

  return (
    <Panel className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gemini Free Tier</p>
          <h2 className="mt-1 text-lg font-semibold text-white">API-Quota heute</h2>
        </div>
        <span className={cx('text-xs font-semibold tabular-nums', textColor)}>
          {percentage}%
        </span>
      </div>

      <div className="mb-3 font-mono text-sm text-slate-300">
        <span className={textColor}>{bar}</span>
        {' '}
        <span className="font-semibold">{today}</span>
        <span className="text-slate-500"> / {limit} heute</span>
      </div>

      <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className={cx('h-full rounded-full transition-all', barColor)}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      <p className="text-xs text-slate-500">{resetLabel}</p>
      {!quota && (
        <p className="mt-1 text-[10px] text-amber-500">Demo-Daten — /api/monitor/quota nicht aktiv</p>
      )}
    </Panel>
  )
}
