'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ChevronRight,
  ExternalLink,
  GitPullRequest,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react'
import { cx } from '@/components/ui/primitives'
import type { PlanStatusResponse, PlanPhaseStatus } from '@/app/api/delegations/plan/[id]/route'

type PhaseStatus = 'not-started' | 'pending' | 'running' | 'completed' | 'failed'

function getPhaseStatus(p: PlanPhaseStatus): PhaseStatus {
  const s = p.delegation?.status
  if (!s || !p.phase.delegationId) return 'not-started'
  if (s === 'completed') return 'completed'
  if (s === 'failed') return 'failed'
  if (s === 'running') return 'running'
  return 'pending'
}

const STATUS_CONFIG: Record<PhaseStatus, { icon: React.ElementType; color: string; label: string }> = {
  'not-started': { icon: Clock,        color: 'text-slate-500',  label: 'Ausstehend'  },
  'pending':     { icon: Clock,        color: 'text-amber-400',  label: 'Wartet'      },
  'running':     { icon: Loader2,      color: 'text-violet-400', label: 'Läuft'       },
  'completed':   { icon: CheckCircle2, color: 'text-emerald-400',label: 'Fertig'      },
  'failed':      { icon: XCircle,      color: 'text-red-400',    label: 'Fehlgeschlagen' },
}

function PhaseCard({ ps, index }: { ps: PlanPhaseStatus; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const status = getPhaseStatus(ps)
  const cfg = STATUS_CONFIG[status]
  const Icon = cfg.icon
  const isRunning = status === 'running'

  return (
    <div
      className={cx(
        'rounded-xl border transition-all',
        status === 'completed' ? 'border-emerald-500/20 bg-emerald-500/[0.04]'
          : status === 'failed'    ? 'border-red-500/20 bg-red-500/[0.04]'
          : status === 'running'   ? 'border-violet-500/30 bg-violet-500/[0.06]'
          : 'border-white/[0.06] bg-white/[0.02]',
      )}
    >
      {/* Header row */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[11px] font-bold text-slate-400">
          {index + 1}
        </span>
        <Icon
          className={cx('h-4 w-4 shrink-0', cfg.color, isRunning && 'animate-spin')}
          strokeWidth={2}
        />
        <span className="flex-1 min-w-0">
          <span className="block truncate text-sm font-semibold text-white">{ps.phase.title}</span>
          <span className={cx('text-[11px] font-medium', cfg.color)}>{cfg.label}</span>
        </span>
        {ps.delegation?.prUrl && (
          <a
            href={ps.delegation.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="shrink-0 flex items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-[11px] font-medium text-violet-300 hover:bg-violet-500/20"
          >
            <GitPullRequest className="h-3 w-3" />
            PR
            <ExternalLink className="h-2.5 w-2.5 opacity-60" />
          </a>
        )}
        {ps.delegation?.id && (
          <Link
            href={`/delegations/${ps.delegation.id}`}
            onClick={e => e.stopPropagation()}
            className="shrink-0 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
          >
            Details →
          </Link>
        )}
        <ChevronRight className={cx('h-3.5 w-3.5 shrink-0 text-slate-600 transition-transform', expanded && 'rotate-90')} />
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-white/[0.04] px-4 py-3 space-y-2.5">
          {ps.phase.description && (
            <p className="text-xs text-slate-400">{ps.phase.description}</p>
          )}
          {ps.phase.dodItems.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-600">Definition of Done</p>
              <ul className="space-y-0.5">
                {ps.phase.dodItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                    <span className={cx('mt-0.5 h-3 w-3 shrink-0', status === 'completed' ? 'text-emerald-400' : 'text-slate-600')}>
                      {status === 'completed' ? '✓' : '○'}
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {ps.phase.dependsOn.length > 0 && (
            <p className="text-[11px] text-slate-600">
              Wartet auf: Phase {ps.phase.dependsOn.join(', ')}
            </p>
          )}
          {ps.delegation?.errorMessage && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2">
              <p className="text-xs font-medium text-red-300">{ps.delegation.errorMessage}</p>
            </div>
          )}
          {ps.delegation?.retryCount !== undefined && ps.delegation.retryCount > 0 && (
            <p className="text-[11px] text-amber-400">Auto-Retry: {ps.delegation.retryCount}× wiederholt</p>
          )}
        </div>
      )}
    </div>
  )
}

function ProgressBar({ summary }: { summary: PlanStatusResponse['summary'] }) {
  const pct = summary.total === 0 ? 0 : Math.round((summary.completed / summary.total) * 100)
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[11px] text-slate-500">
        <span>{summary.completed}/{summary.total} Phasen abgeschlossen</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/[0.06]">
        <div
          className={cx(
            'h-full rounded-full transition-all duration-500',
            summary.failed > 0 ? 'bg-red-500' : summary.running > 0 ? 'bg-violet-500' : 'bg-emerald-500',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function PlanStatusPage() {
  const params = useParams()
  const planId = typeof params.id === 'string' ? params.id : ''

  const [data, setData] = useState<PlanStatusResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/delegations/plan/${planId}`)
      if (!res.ok) {
        const body = await res.json() as { error?: string }
        setError(body.error ?? 'Fehler beim Laden')
        return
      }
      setData(await res.json() as PlanStatusResponse)
      setLastRefresh(new Date())
    } catch {
      setError('Netzwerkfehler')
    }
  }, [planId])

  useEffect(() => {
    load()
  }, [load])

  // Poll every 4s while any phase is running
  useEffect(() => {
    if (!data) return
    const isActive = data.summary.running > 0 || data.status === 'executing'
    if (!isActive) return
    const id = setInterval(load, 4000)
    return () => clearInterval(id)
  }, [data, load])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="text-center space-y-3">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-400" />
          <p className="text-sm text-slate-400">{error}</p>
          <Link href="/delegations/plan" className="text-sm text-violet-400 hover:underline">← Zurück zu Plan Mode</Link>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
      </div>
    )
  }

  const isActive = data.summary.running > 0 || data.status === 'executing'

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-600" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-slate-400 transition-colors">Command Center</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/delegations/plan" className="hover:text-slate-400 transition-colors">Plan Mode</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-slate-400 truncate max-w-[200px]">{data.goal}</span>
      </nav>

      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-lg font-bold text-white leading-snug">{data.goal}</h1>
          <button
            type="button"
            onClick={load}
            title="Aktualisieren"
            className="shrink-0 rounded-lg border border-white/[0.06] bg-white/[0.03] p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="text-sm text-slate-400">{data.overview}</p>
        <p className="text-[11px] text-slate-600">
          Aktualisiert: {lastRefresh.toLocaleTimeString('de-DE')}
          {isActive && <span className="ml-2 text-violet-400 animate-pulse">● Live</span>}
        </p>
      </div>

      {/* Progress bar */}
      <ProgressBar summary={data.summary} />

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Gesamt',      value: data.summary.total,     color: 'text-slate-300' },
          { label: 'Läuft',       value: data.summary.running,   color: 'text-violet-400' },
          { label: 'Fertig',      value: data.summary.completed, color: 'text-emerald-400' },
          { label: 'Fehler',      value: data.summary.failed,    color: 'text-red-400'    },
        ].map(stat => (
          <div key={stat.label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
            <p className={cx('text-xl font-bold tabular-nums', stat.color)}>{stat.value}</p>
            <p className="text-[10px] text-slate-600 uppercase tracking-wide mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Phase timeline */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 px-1">Phasen</p>
        {data.phases.map((ps, i) => (
          <PhaseCard key={ps.phase.id} ps={ps} index={i} />
        ))}
      </div>

      {/* Done state */}
      {data.summary.completed === data.summary.total && data.summary.total > 0 && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] px-4 py-4 text-center space-y-2">
          <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-400" />
          <p className="text-sm font-semibold text-emerald-300">Alle Phasen abgeschlossen</p>
          <Link
            href="/delegations"
            className="inline-flex items-center gap-1 text-sm text-emerald-400 hover:underline"
          >
            Delegations ansehen <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  )
}
