'use client'

import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  Activity, Zap, Bot, DollarSign, Clock, Square,
  ChevronRight, Cpu, Cloud, AlertTriangle, CheckCircle2,
  Circle, TrendingUp, Play, StopCircle, ChevronDown,
} from 'lucide-react'
import type { Delegation, AgentLog, CostSavings } from '@/lib/models/delegation'
import type { OllamaStatus } from '@/app/api/ollama/route'
import type { DriftAnalysis } from '@/lib/drift-detector'
import type { LiveAgentState } from '@/lib/models/live-agent'
import { ElapsedTimer } from '@/components/shared/ElapsedTimer'
import { cx } from '@/components/ui/primitives'
import { AgentStatusMatrix } from '@/components/delegation/AgentStatusMatrix'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ROUTE_META: Record<string, { label: string; color: string; icon: React.ElementType; free: boolean }> = {
  'ollama-agent': { label: 'Ollama · Lokal', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25', icon: Cpu, free: true },
  'local-agent':  { label: 'Claude Max',     color: 'text-violet-400 bg-violet-500/10 border-violet-500/25',   icon: Cloud, free: false },
  'simulation':   { label: 'Simulation',     color: 'text-slate-400 bg-slate-500/10 border-slate-500/20',      icon: Circle, free: true },
}

const LOG_COLORS: Record<AgentLog['type'], string> = {
  info:    'text-slate-300',
  success: 'text-emerald-400',
  error:   'text-rose-400',
  command: 'text-violet-300 font-mono',
  thought: 'text-amber-300/80 italic',
}

function driftColor(score: number): string {
  if (score >= 50) return 'text-rose-400'
  if (score >= 25) return 'text-amber-400'
  return 'text-emerald-400'
}

/** Extract latest token info from Ollama progress log lines ("📊 Turn X/Y · Z Tokens · …") */
function extractTokensFromLogs(logs: AgentLog[]): { tokens: number; savedUsd: number } | null {
  for (let i = logs.length - 1; i >= 0; i--) {
    const m = logs[i].message.match(/(\d[\d,]+)\s+Tokens.*Ersparnis:\s*\$([0-9.]+)/)
    if (m) {
      return { tokens: parseInt(m[1].replace(/,/g, ''), 10), savedUsd: parseFloat(m[2]) }
    }
  }
  return null
}

// ─── System Status Bar ────────────────────────────────────────────────────────

function SystemStatusBar({ ollama, claudeMax, running, maxConcurrent }: {
  ollama: OllamaStatus | null
  claudeMax: boolean | null
  running: number
  maxConcurrent: number
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
      {/* Ollama */}
      <div className="flex items-center gap-2">
        <Cpu className="h-3.5 w-3.5 text-slate-500" />
        <span className="text-xs font-semibold text-slate-500">Ollama</span>
        {ollama === null ? (
          <span className="text-xs text-slate-600">…</span>
        ) : ollama.reachable ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-xs text-emerald-400">{ollama.totalModels} Modelle</span>
            {ollama.activeModels.length > 0 && (
              <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">
                {ollama.activeModels[0].name.split(':')[0]} aktiv
              </span>
            )}
          </>
        ) : (
          <>
            <span className="h-2 w-2 rounded-full bg-slate-600" />
            <span className="text-xs text-slate-500">Nicht erreichbar</span>
          </>
        )}
      </div>

      <div className="h-4 w-px bg-white/[0.06]" />

      {/* Claude */}
      <div className="flex items-center gap-2">
        <Cloud className="h-3.5 w-3.5 text-slate-500" />
        <span className="text-xs font-semibold text-slate-500">Claude</span>
        {claudeMax === null ? (
          <span className="text-xs text-slate-600">…</span>
        ) : claudeMax ? (
          <>
            <span className="h-2 w-2 rounded-full bg-violet-400" />
            <span className="text-xs text-violet-400">Max aktiv</span>
          </>
        ) : (
          <>
            <span className="h-2 w-2 rounded-full bg-slate-600" />
            <span className="text-xs text-slate-500">Nicht eingeloggt</span>
          </>
        )}
      </div>

      <div className="h-4 w-px bg-white/[0.06]" />

      {/* Concurrency */}
      <div className="flex items-center gap-2">
        <Bot className="h-3.5 w-3.5 text-slate-500" />
        <span className="text-xs font-semibold text-slate-500">Agents</span>
        <span className={cx('text-xs font-bold tabular-nums', running > 0 ? 'text-white' : 'text-slate-500')}>
          {running}
        </span>
        <span className="text-xs text-slate-600">/ {maxConcurrent}</span>
        <div className="flex gap-0.5">
          {Array.from({ length: maxConcurrent }).map((_, i) => (
            <div
              key={i}
              className={cx('h-2 w-4 rounded-sm', i < running ? 'bg-emerald-500' : 'bg-white/[0.08]')}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Live Agent Panel ─────────────────────────────────────────────────────────

function AgentLivePanel({ state, onStop, stopping }: {
  state: LiveAgentState
  onStop: (id: string) => void
  stopping: boolean
}) {
  const d = state.delegation
  const logRef = useRef<HTMLDivElement>(null)
  const routeMeta = ROUTE_META[d.executionRoute ?? 'local-agent'] ?? ROUTE_META['local-agent']
  const RouteIcon = routeMeta.icon
  const budgetPct = d.contract.maxBudgetUsd > 0
    ? Math.min(100, Math.round(((state.actualCostUsd ?? d.costEstimateUsd ?? 0) / d.contract.maxBudgetUsd) * 100))
    : 0

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [state.logs])

  const isTerminal = ['completed', 'failed', 'cancelled'].includes(state.status)
  const drift = state.drift

  // Token savings: prefer completed summaryReport, fallback to live log parsing
  const reportSavings: CostSavings | undefined = d.summaryReport?.costSavings
  const liveTokens = reportSavings ? null : extractTokensFromLogs(state.logs)
  const tokensTotal = reportSavings?.tokensUsed.totalTokens ?? liveTokens?.tokens
  const savedUsd = reportSavings?.savedUsd ?? liveTokens?.savedUsd

  return (
    <div className={cx(
      'flex flex-col rounded-xl border transition-colors',
      state.status === 'running'   ? 'border-violet-500/20 bg-violet-500/[0.03]' :
      state.status === 'completed' ? 'border-emerald-500/20 bg-emerald-500/[0.03]' :
      state.status === 'failed'    ? 'border-rose-500/20 bg-rose-500/[0.03]' :
                                     'border-white/[0.07] bg-white/[0.02]'
    )}>
      {/* Panel header */}
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            {/* Route badge */}
            <span className={cx('flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold', routeMeta.color)}>
              <RouteIcon className="h-3 w-3" />
              {routeMeta.label}
              {routeMeta.free && <span className="text-[9px] opacity-70">FREE</span>}
            </span>
            {/* Risk */}
            <span className="rounded border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
              Risk {d.contract.riskClass}
            </span>
            {/* Work item */}
            <span className="font-mono text-[10px] text-slate-600">{d.contract.workItemId}</span>
            {/* Elapsed */}
            {state.status === 'running' && (
              <ElapsedTimer startedAt={d.updatedAt || d.createdAt} className="font-mono text-[10px] text-slate-500" />
            )}
          </div>
          <Link href={`/delegations/${d.id}`} className="block truncate text-sm font-semibold text-white hover:text-violet-300 transition-colors">
            {d.title || d.contract.goal.slice(0, 80)}
          </Link>
        </div>

        {/* Controls */}
        <div className="flex shrink-0 items-center gap-2">
          {state.status === 'running' && (
            <button
              onClick={() => onStop(d.id)}
              disabled={stopping}
              className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-400 transition-all hover:bg-rose-500/20 disabled:opacity-40"
            >
              <Square className="h-3 w-3" />
              Stop
            </button>
          )}
          <Link
            href={`/delegations/${d.id}`}
            className="flex items-center gap-1 rounded-lg border border-white/[0.1] bg-white/[0.05] px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-all hover:bg-white/[0.1]"
          >
            Detail <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Metrics row */}
      <div className="flex items-center gap-4 border-b border-white/[0.04] px-4 py-2">
        {/* Cost */}
        <div className="flex items-center gap-1.5">
          <DollarSign className="h-3 w-3 text-slate-600" />
          <span className="text-xs font-mono font-bold text-white">
            ${(state.actualCostUsd ?? d.costEstimateUsd ?? 0).toFixed(4)}
          </span>
          {routeMeta.free && <span className="text-[10px] text-emerald-500">FREE</span>}
        </div>

        <div className="h-3 w-px bg-white/[0.06]" />

        {/* Budget bar */}
        {d.contract.maxBudgetUsd > 0 && (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={cx('h-full rounded-full transition-all', budgetPct >= 80 ? 'bg-rose-500' : budgetPct >= 60 ? 'bg-amber-500' : 'bg-emerald-500')}
                style={{ width: `${budgetPct}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500">{budgetPct}% Budget</span>
          </div>
        )}

        <div className="h-3 w-px bg-white/[0.06]" />

        {/* Token count */}
        {tokensTotal != null && tokensTotal > 0 && (
          <>
            <div className="h-3 w-px bg-white/[0.06]" />
            <div className="flex items-center gap-1.5">
              <Cpu className="h-3 w-3 text-slate-600" />
              <span className="text-xs font-mono text-slate-300">{tokensTotal.toLocaleString('de')}</span>
              <span className="text-[10px] text-slate-600">tok</span>
            </div>
          </>
        )}

        {/* Savings badge */}
        {savedUsd != null && savedUsd > 0 && (
          <>
            <div className="h-3 w-px bg-white/[0.06]" />
            <div className="flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5">
              <DollarSign className="h-2.5 w-2.5 text-emerald-400" />
              <span className="text-[10px] font-bold text-emerald-400">{savedUsd.toFixed(4)} gespart</span>
            </div>
          </>
        )}

        {/* Drift score */}
        {drift && (
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3 text-slate-600" />
            <span className={cx('text-xs font-bold tabular-nums', driftColor(drift.driftScore))}>
              Drift {drift.driftScore}
            </span>
            <span className="text-[10px] text-slate-600">/100</span>
          </div>
        )}

        {/* Status pill */}
        <div className="ml-auto">
          {state.status === 'running' ? (
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              LIVE
            </span>
          ) : state.status === 'completed' ? (
            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
              <CheckCircle2 className="h-3 w-3" /> Done
            </span>
          ) : state.status === 'failed' ? (
            <span className="flex items-center gap-1 text-[10px] font-bold text-rose-400">
              <AlertTriangle className="h-3 w-3" /> Failed
            </span>
          ) : null}
        </div>
      </div>

      {/* Drift warning banner */}
      {drift && drift.hasDrift && drift.signals.length > 0 && (
        <div className="border-b border-amber-500/20 bg-amber-500/[0.05] px-4 py-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
            <div>
              <p className="text-[11px] font-semibold text-amber-400">Drift erkannt — {drift.recommendation}</p>
              {drift.signals.slice(0, 2).map((s, i) => (
                <p key={i} className="text-[10px] text-amber-400/60">{s.message.slice(0, 80)}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Live log stream */}
      <div
        ref={logRef}
        className="flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-5 scrollbar-hide"
        style={{ minHeight: 180, maxHeight: 320 }}
      >
        {state.logs.length === 0 ? (
          <p className="text-slate-600 italic">Warte auf erste Log-Einträge…</p>
        ) : (
          state.logs.map((log, i) => (
            <div key={i} className="flex gap-2">
              <span className="shrink-0 text-slate-700 tabular-nums select-none">
                {new Date(log.timestamp).toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className={cx('break-words', LOG_COLORS[log.type] ?? 'text-slate-400')}>
                {log.message}
              </span>
            </div>
          ))
        )}
        {!isTerminal && state.streaming && (
          <div className="mt-1 flex items-center gap-1.5 text-violet-400/50">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
            <span className="text-[10px]">streaming…</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Approved Quick-Start Card ────────────────────────────────────────────────

function ApprovedCard({ d, onStart, starting }: {
  d: Delegation
  onStart: (id: string) => void
  starting: boolean
}) {
  const routeMeta = ROUTE_META[d.executionRoute ?? 'local-agent'] ?? ROUTE_META['local-agent']
  const RouteIcon = routeMeta.icon
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className={cx('flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold', routeMeta.color)}>
          <RouteIcon className="h-3 w-3" />
          {routeMeta.free ? 'FREE' : 'Max'}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{d.title || d.contract.goal.slice(0, 60)}</p>
          <p className="text-[10px] text-slate-500">{d.contract.workItemId} · Risk {d.contract.riskClass} · ${d.contract.maxBudgetUsd}</p>
        </div>
      </div>
      <button
        onClick={() => onStart(d.id)}
        disabled={starting}
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-400 transition-all hover:bg-emerald-500/20 disabled:opacity-40"
      >
        <Play className="h-3 w-3" />
        {starting ? 'Startet…' : 'Starten'}
      </button>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function ActiveRunsContent() {
  const searchParams = useSearchParams()
  const focusId = searchParams.get('focus')
  const focusRef = useRef<HTMLDivElement>(null)
  const [delegations, setDelegations] = useState<Delegation[]>([])
  const [loading, setLoading] = useState(true)
  const [liveStates, setLiveStates] = useState<Map<string, LiveAgentState>>(new Map())
  const [ollama, setOllama] = useState<OllamaStatus | null>(null)
  const [claudeMax, setClaudeMax] = useState<boolean | null>(null)
  const [maxConcurrent, setMaxConcurrent] = useState(2)
  const [stoppingId, setStoppingId] = useState<string | null>(null)
  const [startingId, setStartingId] = useState<string | null>(null)
  const [stoppingAll, setStoppingAll] = useState(false)
  const [showStartDropdown, setShowStartDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const eventSourcesRef = useRef<Map<string, EventSource>>(new Map())

  const loadDelegations = useCallback(async () => {
    const res = await fetch('/api/delegations')
    const all = await res.json() as Delegation[]
    setDelegations(all)
    setLoading(false)
    return all
  }, [])

  // Scroll to focused delegation after load
  useEffect(() => {
    if (!focusId || loading) return
    const timer = setTimeout(() => {
      if (focusRef.current) {
        focusRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [focusId, loading])

  // Initialize or update live state for a delegation
  const ensureLiveState = useCallback((d: Delegation) => {
    setLiveStates(prev => {
      if (prev.has(d.id)) return prev
      const next = new Map(prev)
      next.set(d.id, {
        delegation: d,
        logs: d.logs ?? [],
        status: d.status,
        actualCostUsd: d.actualCostUsd,
        streaming: false,
      })
      return next
    })
  }, [])

  // Subscribe to SSE stream for a delegation
  const subscribeSSE = useCallback((id: string) => {
    if (eventSourcesRef.current.has(id)) return
    const es = new EventSource(`/api/delegations/${id}/stream`)

    es.addEventListener('init', (e: MessageEvent) => {
      const data = JSON.parse(e.data as string) as { status: Delegation['status']; logs: AgentLog[]; actualCostUsd?: number }
      setLiveStates(prev => {
        const next = new Map(prev)
        const existing = next.get(id)
        if (existing) {
          next.set(id, { ...existing, logs: data.logs, status: data.status, actualCostUsd: data.actualCostUsd, streaming: true })
        }
        return next
      })
    })

    es.addEventListener('logs', (e: MessageEvent) => {
      const data = JSON.parse(e.data as string) as { logs: AgentLog[] }
      setLiveStates(prev => {
        const next = new Map(prev)
        const existing = next.get(id)
        if (existing) {
          next.set(id, { ...existing, logs: [...existing.logs, ...data.logs] })
        }
        return next
      })
    })

    es.addEventListener('status', (e: MessageEvent) => {
      const data = JSON.parse(e.data as string) as { status: Delegation['status']; actualCostUsd?: number }
      setLiveStates(prev => {
        const next = new Map(prev)
        const existing = next.get(id)
        if (existing) {
          next.set(id, { ...existing, status: data.status, actualCostUsd: data.actualCostUsd ?? existing.actualCostUsd, streaming: false })
        }
        return next
      })
      const terminal = ['completed', 'failed', 'cancelled']
      if (terminal.includes(data.status)) {
        es.close()
        eventSourcesRef.current.delete(id)
      }
    })

    es.onerror = () => {
      es.close()
      eventSourcesRef.current.delete(id)
    }

    eventSourcesRef.current.set(id, es)
  }, [])

  // Fetch drift score for a delegation
  const fetchDrift = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/delegations/drift?id=${id}`)
      const data = await res.json() as { drift: DriftAnalysis }
      setLiveStates(prev => {
        const next = new Map(prev)
        const existing = next.get(id)
        if (existing) next.set(id, { ...existing, drift: data.drift })
        return next
      })
    } catch { /* non-critical */ }
  }, [])

  // Main data + system status fetch
  useEffect(() => {
    const fetchAll = async () => {
      const [all] = await Promise.all([
        loadDelegations(),
        fetch('/api/ollama').then(r => r.json()).then((d: OllamaStatus) => setOllama(d)).catch(() => {}),
        fetch('/api/auth/status').then(r => r.json()).then((d: { subscriptionType?: string }) => {
          setClaudeMax(d.subscriptionType === 'max' || d.subscriptionType === 'claude_ai')
        }).catch(() => setClaudeMax(false)),
        fetch('/api/settings').then(r => r.json()).then((d: { maxConcurrentAgents?: number }) => {
          if (d.maxConcurrentAgents) setMaxConcurrent(d.maxConcurrentAgents)
        }).catch(() => {}),
      ])
      return all
    }

    fetchAll().then(all => {
      const activeOnes = all.filter(d => d.status === 'running' || d.status === 'completed' || d.status === 'failed')
      activeOnes.forEach(d => {
        ensureLiveState(d)
        if (d.status === 'running') {
          subscribeSSE(d.id)
          fetchDrift(d.id)
        }
      })
    })

    const interval = setInterval(async () => {
      const all = await loadDelegations()
      all.filter(d => d.status === 'running').forEach(d => {
        ensureLiveState(d)
        subscribeSSE(d.id)
        fetchDrift(d.id)
      })
    }, 4000)

    const sources = eventSourcesRef.current
    return () => {
      clearInterval(interval)
      sources.forEach(es => es.close())
    }
  }, [loadDelegations, ensureLiveState, subscribeSSE, fetchDrift])

  const handleStop = async (id: string) => {
    setStoppingId(id)
    await fetch(`/api/delegations/${id}/cancel`, { method: 'POST' })
    await loadDelegations()
    setStoppingId(null)
  }

  const handleStart = async (id: string) => {
    setStartingId(id)
    try {
      await fetch(`/api/delegations/${id}/execute`, { method: 'POST' })
      await loadDelegations()
    } finally {
      setStartingId(null)
    }
  }

  const handleStartAll = async () => {
    const approved = delegations.filter(d => d.status === 'approved')
    for (const d of approved.slice(0, maxConcurrent)) {
      await fetch(`/api/delegations/${d.id}/execute`, { method: 'POST' })
    }
    await loadDelegations()
  }

  const handleStopAll = async () => {
    const runningOnes = delegations.filter(d => d.status === 'running')
    setStoppingAll(true)
    try {
      await Promise.all(
        runningOnes.map(d => fetch(`/api/delegations/${d.id}/cancel`, { method: 'POST' }))
      )
      await loadDelegations()
    } finally {
      setStoppingAll(false)
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowStartDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const running = delegations.filter(d => d.status === 'running')
  const approved = delegations.filter(d => d.status === 'approved')
  const recentDone = delegations
    .filter(d => d.status === 'completed' || d.status === 'failed')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 3)

  const totalActualCost = delegations
    .filter(d => d.actualCostUsd != null)
    .reduce((sum, d) => sum + (d.actualCostUsd ?? 0), 0)

  const totalSavedUsd = delegations
    .reduce((sum, d) => sum + (d.summaryReport?.costSavings?.savedUsd ?? 0), 0)

  const totalTokensUsed = delegations
    .reduce((sum, d) => sum + (d.summaryReport?.costSavings?.tokensUsed.totalTokens ?? 0), 0)

  if (loading) {
    return (
      <main className="min-h-screen p-6 text-white">
        <div className="mx-auto max-w-7xl space-y-4">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-white/[0.06]" />
          <div className="h-16 animate-pulse rounded-xl border border-white/[0.07] bg-white/[0.03]" />
          <div className="h-64 animate-pulse rounded-xl border border-white/[0.07] bg-white/[0.03]" />
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-6 text-white">
      <div className="mx-auto max-w-7xl space-y-5">

        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="page-eyebrow">Execute</p>
            <h1 className="page-title">Mission Control</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* KPI pills */}
            <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5">
              <DollarSign className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-xs font-mono font-bold text-white">${totalActualCost.toFixed(3)}</span>
              <span className="text-[10px] text-slate-500">Kosten</span>
            </div>
            {totalSavedUsd > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5">
                <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-xs font-mono font-bold text-emerald-400">${totalSavedUsd.toFixed(3)}</span>
                <span className="text-[10px] text-emerald-600">gespart</span>
              </div>
            )}
            {totalTokensUsed > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5">
                <Cpu className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-xs font-mono font-bold text-white">{totalTokensUsed.toLocaleString('de')}</span>
                <span className="text-[10px] text-slate-500">Tokens</span>
              </div>
            )}

            {/* Quick-Stop All — nur wenn ≥2 Agents laufen */}
            {running.length >= 2 && (
              <button
                onClick={handleStopAll}
                disabled={stoppingAll}
                className="flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-1.5 text-sm font-bold text-rose-400 transition-all hover:bg-rose-500/25 disabled:opacity-40"
              >
                <StopCircle className="h-4 w-4" />
                {stoppingAll ? 'Stoppe…' : `Alle stoppen (${running.length})`}
              </button>
            )}

            {/* "Neue Delegation starten" Dropdown */}
            {(approved.length > 0 || delegations.some(d => d.status === 'pending')) && (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowStartDropdown(prev => !prev)}
                  className="flex items-center gap-2 rounded-lg border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-sm font-bold text-violet-300 transition-all hover:bg-violet-500/25"
                >
                  <Play className="h-4 w-4" />
                  Neue Delegation starten
                  <ChevronDown className={cx('h-3.5 w-3.5 transition-transform', showStartDropdown && 'rotate-180')} />
                </button>

                {showStartDropdown && (
                  <div className="absolute right-0 top-full z-50 mt-1 w-96 rounded-xl border border-white/[0.1] bg-[#0f0f14] shadow-2xl">
                    <div className="border-b border-white/[0.06] px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                        Startbereit
                      </p>
                    </div>
                    <div className="max-h-72 overflow-y-auto p-1.5">
                      {[
                        ...delegations.filter(d => d.status === 'approved'),
                        ...delegations.filter(d => d.status === 'pending'),
                      ].slice(0, 5).map(d => {
                        const routeMeta = ROUTE_META[d.executionRoute ?? 'local-agent'] ?? ROUTE_META['local-agent']
                        const RouteIcon = routeMeta.icon
                        return (
                          <button
                            key={d.id}
                            disabled={startingId === d.id}
                            onClick={async () => {
                              setShowStartDropdown(false)
                              await handleStart(d.id)
                            }}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/[0.05] disabled:opacity-40"
                          >
                            <span className={cx('flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold', routeMeta.color)}>
                              <RouteIcon className="h-2.5 w-2.5" />
                              {routeMeta.free ? 'FREE' : 'Max'}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium text-white">
                                {d.title || d.contract.goal.slice(0, 55)}
                              </p>
                              <p className="text-[10px] text-slate-600">
                                {d.contract.workItemId} · Risk {d.contract.riskClass} ·{' '}
                                <span className={cx(
                                  'font-semibold',
                                  d.status === 'approved' ? 'text-emerald-500' : 'text-amber-500'
                                )}>
                                  {d.status === 'approved' ? 'Genehmigt' : 'Ausstehend'}
                                </span>
                              </p>
                            </div>
                            <Play className="h-3.5 w-3.5 shrink-0 text-violet-400" />
                          </button>
                        )
                      })}
                      {delegations.filter(d => d.status === 'approved' || d.status === 'pending').length === 0 && (
                        <p className="px-3 py-4 text-center text-xs text-slate-600">
                          Keine Delegationen verfügbar
                        </p>
                      )}
                    </div>
                    <div className="border-t border-white/[0.06] p-1.5">
                      <Link
                        href="/delegations"
                        onClick={() => setShowStartDropdown(false)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs text-slate-500 transition-colors hover:bg-white/[0.04] hover:text-slate-300"
                      >
                        Alle Delegationen anzeigen <ChevronRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Alle-starten shortcut wenn approved vorhanden */}
            {approved.length > 0 && (
              <button
                onClick={handleStartAll}
                className="flex items-center gap-2 rounded-lg border border-violet-500/20 bg-white/[0.04] px-3 py-1.5 text-sm font-bold text-violet-400/70 transition-all hover:bg-violet-500/10"
              >
                <Activity className="h-4 w-4" />
                Alle starten ({Math.min(approved.length, maxConcurrent)})
              </button>
            )}

            <Link href="/delegations" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-300 transition-colors">
              Queue <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* System status bar + Agent Status Matrix */}
        <div className="space-y-2">
          <SystemStatusBar
            ollama={ollama}
            claudeMax={claudeMax}
            running={running.length}
            maxConcurrent={maxConcurrent}
          />
          <AgentStatusMatrix liveStates={Array.from(liveStates.values())} />
        </div>

        {/* Mission Control — Live Agent Grid */}
        {running.length > 0 ? (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400">Live — {running.length} Agent{running.length > 1 ? 's' : ''}</h2>
            </div>
            <div className={cx('grid gap-4', running.length >= 2 ? 'lg:grid-cols-2' : 'grid-cols-1')}>
              {running.map(d => {
                const state = liveStates.get(d.id) ?? {
                  delegation: d, logs: d.logs ?? [], status: d.status,
                  actualCostUsd: d.actualCostUsd, streaming: false,
                }
                const isFocused = focusId === d.id
                return (
                  <div
                    key={d.id}
                    ref={isFocused ? focusRef : null}
                    className={isFocused ? 'ring-2 ring-sky-500/60 rounded-xl' : undefined}
                  >
                    <AgentLivePanel
                      state={state}
                      onStop={handleStop}
                      stopping={stoppingId === d.id}
                    />
                  </div>
                )
              })}
            </div>
          </section>
        ) : (
          <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.07] bg-white/[0.02] p-8 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
              <Zap className="h-5 w-5 text-slate-500" />
            </div>
            <p className="font-semibold text-white">Keine aktiven Agents</p>
            <p className="mt-1 text-sm text-slate-500">
              {approved.length > 0
                ? `${approved.length} Delegation${approved.length > 1 ? 'en' : ''} genehmigt und startbereit`
                : 'Erstelle und genehmige eine Delegation um Agents zu starten'}
            </p>
          </div>
        )}

        {/* Recently finished — with live panel replay */}
        {recentDone.length > 0 && (
          <section>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Zuletzt abgeschlossen</h2>
            <div className={cx('grid gap-4', recentDone.length >= 2 ? 'lg:grid-cols-2' : 'grid-cols-1')}>
              {recentDone.map(d => {
                const state = liveStates.get(d.id) ?? {
                  delegation: d, logs: d.logs ?? [], status: d.status,
                  actualCostUsd: d.actualCostUsd, streaming: false,
                }
                return (
                  <AgentLivePanel
                    key={d.id}
                    state={state}
                    onStop={handleStop}
                    stopping={false}
                  />
                )
              })}
            </div>
          </section>
        )}

        {/* Ready to start */}
        {approved.length > 0 && (
          <section>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Bereit zum Start</h2>
            <div className="space-y-2">
              {approved.map(d => {
                const isFocused = focusId === d.id
                return (
                  <div
                    key={d.id}
                    ref={isFocused ? focusRef : null}
                    className={isFocused ? 'ring-2 ring-sky-500/60 rounded-xl' : undefined}
                  >
                    <ApprovedCard
                      d={d}
                      onStart={handleStart}
                      starting={startingId === d.id}
                    />
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Clock line */}
        <div className="flex items-center justify-center gap-2 py-2 text-[11px] text-slate-700">
          <Clock className="h-3 w-3" />
          <span>Aktualisiert alle 4 Sekunden · SSE Live-Stream aktiv bei laufenden Agents</span>
        </div>

      </div>
    </main>
  )
}

export default function ActiveRunsPage() {
  return (
    <Suspense fallback={null}>
      <ActiveRunsContent />
    </Suspense>
  )
}
