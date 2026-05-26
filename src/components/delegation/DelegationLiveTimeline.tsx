'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  DollarSign,
  ExternalLink,
  Radio,
  XCircle,
} from 'lucide-react'
import type { AgentLog, Delegation, DelegationStatus } from '@/lib/models/delegation'
import { cx } from '@/components/ui/primitives'
import { ElapsedTimer } from '@/components/shared/ElapsedTimer'
import { AgentPhaseIndicator } from '@/components/delegation/AgentPhaseIndicator'
import { inferAgentPhase } from '@/lib/delegations/agent-phase'

// ── Constants ────────────────────────────────────────────────────────────────

const STREAM_URL = '/api/delegations/live-stream'
/** Re-connect EventSource after this many ms on error */
const RECONNECT_MS = 5_000

// ── Pure helpers (exported for testing) ─────────────────────────────────────

/** Returns the last log entry or undefined if no logs. */
export function getLatestLog(logs: AgentLog[] | undefined): AgentLog | undefined {
  if (!logs || logs.length === 0) return undefined
  return logs[logs.length - 1]
}

/** Budget usage percentage (0–100, clamped). */
export function budgetPercent(actualCostUsd: number | undefined, maxBudgetUsd: number): number {
  if (!actualCostUsd || maxBudgetUsd <= 0) return 0
  return Math.min(100, Math.round((actualCostUsd / maxBudgetUsd) * 100))
}

/** Color class for the cost bar. */
export function costBarColor(pct: number): string {
  if (pct >= 90) return 'bg-rose-500'
  if (pct >= 70) return 'bg-amber-500'
  return 'bg-emerald-500'
}

/** Risk-badge color classes. */
export function riskBadgeClass(riskClass: 'A' | 'B' | 'C'): string {
  return riskClass === 'C'
    ? 'border-rose-700/50 bg-rose-950/20 text-rose-400'
    : riskClass === 'B'
      ? 'border-amber-700/50 bg-amber-950/20 text-amber-400'
      : 'border-emerald-700/50 bg-emerald-950/20 text-emerald-400'
}

/** Status icon component selection. */
export function statusIconName(status: DelegationStatus): string {
  switch (status) {
    case 'running': return 'radio'
    case 'completed': return 'check'
    case 'failed': return 'x'
    default: return 'circle'
  }
}

/**
 * Build the Jaeger/Honeycomb trace URL for a delegation, if a traceId is set
 * and `NEXT_PUBLIC_JAEGER_UI_URL` is configured.
 */
export function buildTraceUrl(traceId: string | undefined, baseUrl?: string): string | undefined {
  if (!traceId) return undefined
  const base = (baseUrl ?? process.env.NEXT_PUBLIC_JAEGER_UI_URL ?? '').replace(/\/$/, '')
  if (!base) return undefined
  return `${base}/trace/${traceId}`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: DelegationStatus }) {
  if (status === 'running')
    return <Radio className="h-3.5 w-3.5 animate-pulse text-amber-400" />
  if (status === 'completed')
    return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
  if (status === 'failed')
    return <XCircle className="h-3.5 w-3.5 text-rose-400" />
  return <Circle className="h-3.5 w-3.5 text-slate-500" />
}

function DelegationCard({ delegation }: { delegation: Delegation }) {
  const d = delegation
  const latestLog = getLatestLog(d.logs)
  const pct = budgetPercent(d.actualCostUsd, d.contract.maxBudgetUsd)
  const traceUrl = buildTraceUrl(d.traceId)
  const phaseInfo = inferAgentPhase(d)

  return (
    <div
      data-testid={`live-card-${d.id}`}
      className={cx(
        'rounded-xl border p-4 transition-colors',
        d.status === 'running'
          ? 'border-amber-700/30 bg-amber-950/10'
          : d.status === 'completed'
            ? 'border-emerald-700/20 bg-emerald-950/[0.07]'
            : d.status === 'failed'
              ? 'border-rose-800/30 bg-rose-950/10'
              : 'border-white/[0.06] bg-white/[0.02]',
      )}
    >
      {/* Card header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <StatusIcon status={d.status} />
          <Link
            href={`/delegations/${d.id}`}
            className="truncate font-semibold text-sm text-white hover:text-violet-300 transition-colors"
          >
            {d.title || d.contract.goal.slice(0, 60)}
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {/* Risk badge */}
          <span
            data-testid={`risk-badge-${d.id}`}
            className={cx(
              'rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase',
              riskBadgeClass(d.contract.riskClass),
            )}
          >
            Risk {d.contract.riskClass}
          </span>

          {/* Elapsed time (only when running) */}
          {d.status === 'running' && (
            <span className="flex items-center gap-1 text-xs font-mono text-slate-400">
              <Clock className="h-3 w-3" />
              <ElapsedTimer startedAt={d.updatedAt} />
            </span>
          )}

          {/* Trace link (when OTel trace ID is available) */}
          {traceUrl && (
            <a
              href={traceUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={`trace-link-${d.id}`}
              title="OTel Trace öffnen"
              className="flex items-center gap-0.5 text-[10px] text-indigo-400 hover:text-indigo-300"
            >
              <ExternalLink className="h-3 w-3" />
              trace
            </a>
          )}

          {/* Detail link */}
          <Link
            href={`/delegations/${d.id}`}
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Cost bar */}
      {d.contract.maxBudgetUsd > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <DollarSign className="h-3 w-3 shrink-0 text-slate-600" />
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-800">
            <div
              data-testid={`cost-bar-${d.id}`}
              className={cx('h-full rounded-full transition-all duration-500', costBarColor(pct))}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="w-28 text-right text-[10px] text-slate-500 tabular-nums">
            ${(d.actualCostUsd ?? 0).toFixed(3)} / ${d.contract.maxBudgetUsd.toFixed(2)}
          </span>
        </div>
      )}

      {/* Agent phase indicator */}
      <AgentPhaseIndicator info={phaseInfo} showProgress className="mt-2" />

      {/* Latest log — show raw log when no structured phase signal is present */}
      {latestLog && phaseInfo.phase === 'exploring' && !phaseInfo.progressSignal && (
        <p
          data-testid={`latest-log-${d.id}`}
          className={cx(
            'mt-1 truncate font-mono text-[11px]',
            latestLog.type === 'error' ? 'text-rose-400' :
            latestLog.type === 'success' ? 'text-emerald-400' :
            latestLog.type === 'command' ? 'text-amber-300' :
            latestLog.type === 'thought' ? 'text-indigo-300' :
            'text-slate-400',
          )}
        >
          {latestLog.type === 'command' ? '$ ' : latestLog.type === 'thought' ? '💭 ' : '  '}
          {latestLog.message}
        </p>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

interface DelegationLiveTimelineProps {
  /** Optional max number of cards to show. Default: unlimited. */
  maxItems?: number
  /** Optional CSS class for the outer wrapper. */
  className?: string
  /** Show "live" / "polling" mode toggle. Default: true. */
  showModeToggle?: boolean
}

/**
 * M164 — Live timeline of all running + recently completed delegations.
 *
 * Uses the global SSE stream `/api/delegations/live-stream` to receive
 * real-time delegation updates without polling. Falls back to a short
 * polling interval on SSE error.
 */
export function DelegationLiveTimeline({
  maxItems,
  className,
  showModeToggle = true,
}: DelegationLiveTimelineProps = {}) {
  const [delegations, setDelegations] = useState<Delegation[]>([])
  const [liveMode, setLiveMode] = useState(true)
  const [connected, setConnected] = useState(false)
  const esRef = useRef<EventSource | null>(null)

  const connectSSE = useCallback(() => {
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }
    const es = new EventSource(STREAM_URL)
    esRef.current = es

    es.addEventListener('delegations', (e) => {
      const data = JSON.parse((e as MessageEvent).data) as {
        delegations: Delegation[]
        count: number
        ts: string
      }
      setDelegations(data.delegations)
      setConnected(true)
    })

    es.onerror = () => {
      setConnected(false)
      setLiveMode(false)
      es.close()
      esRef.current = null
    }
  }, [])

  // Polling fallback
  const pollOnce = useCallback(async () => {
    try {
      const res = await fetch('/api/delegations')
      if (!res.ok) return
      const data = (await res.json()) as Delegation[]
      if (Array.isArray(data)) {
        const now = Date.now()
        const WINDOW = 5 * 60 * 1_000
        setDelegations(
          data.filter(d => {
            if (d.status === 'running') return true
            if (d.status === 'completed' || d.status === 'failed') {
              return now - new Date(d.updatedAt).getTime() < WINDOW
            }
            return false
          }),
        )
      }
    } catch {
      // non-critical
    }
  }, [])

  // SSE connection
  useEffect(() => {
    if (!liveMode) return
    connectSSE()

    return () => {
      esRef.current?.close()
      esRef.current = null
    }
  }, [liveMode, connectSSE])

  // Polling fallback
  useEffect(() => {
    if (liveMode) return
    void pollOnce()
    const id = window.setInterval(() => void pollOnce(), 4_000)
    return () => window.clearInterval(id)
  }, [liveMode, pollOnce])

  const visible = maxItems ? delegations.slice(0, maxItems) : delegations

  return (
    <div data-testid="delegation-live-timeline" className={cx('space-y-4', className)}>
      {/* Header bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-semibold text-white">Live Timeline</span>
          {delegations.length > 0 && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
              {delegations.length}
            </span>
          )}
          {connected && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              Live
            </span>
          )}
        </div>

        {showModeToggle && (
          <button
            onClick={() => setLiveMode(v => !v)}
            className={cx(
              'rounded border px-2 py-1 text-[10px] font-semibold transition-colors',
              liveMode
                ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
                : 'border-slate-700 text-slate-500 hover:text-slate-300',
            )}
          >
            {liveMode ? 'SSE' : 'Poll'}
          </button>
        )}
      </div>

      {/* Empty state */}
      {visible.length === 0 && (
        <div className="rounded-xl border border-white/[0.06] p-8 text-center">
          <Activity className="mx-auto h-6 w-6 text-slate-600" />
          <p className="mt-3 text-sm font-semibold text-white">Keine aktiven Delegations</p>
          <p className="mt-1 text-xs text-slate-500">
            Laufende Delegations erscheinen hier in Echtzeit
          </p>
        </div>
      )}

      {/* Cards */}
      {visible.length > 0 && (
        <div className="space-y-3">
          {visible.map(d => (
            <DelegationCard key={d.id} delegation={d} />
          ))}
        </div>
      )}

      {/* Overflow hint */}
      {maxItems && delegations.length > maxItems && (
        <Link
          href="/active"
          className="flex items-center justify-center gap-1 rounded-lg border border-white/[0.06] py-2 text-xs text-slate-500 transition-colors hover:text-slate-300"
        >
          +{delegations.length - maxItems} weitere
          <ChevronRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  )
}
