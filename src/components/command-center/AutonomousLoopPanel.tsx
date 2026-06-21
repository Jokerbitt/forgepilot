'use client'

/**
 * AutonomousLoopPanel — The closed autonomous assistant loop visualized.
 *
 * Shows:
 * - Current loop state (what's happening right now)
 * - THE single next action to take
 * - Today's progress ring
 * - One-click "Weiter" button
 *
 * Polls every 8 seconds while something is running.
 */

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Play,
  RefreshCw,
  XCircle,
  Zap,
} from 'lucide-react'
import { cx } from '@/components/ui/primitives'
import type { NextLoopAction, LoopStats } from '@/lib/delegations/loop-closure'

interface LoopResponse {
  nextAction: NextLoopAction
  stats: LoopStats
  generatedAt: string
}

function ProgressRing({ value, max, size = 56 }: { value: number; max: number; size?: number }) {
  const pct = max > 0 ? Math.min(1, value / max) : 0
  const r = (size - 6) / 2
  const circ = 2 * Math.PI * r
  const dash = circ * pct
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={pct >= 0.8 ? '#34d399' : pct >= 0.5 ? '#a78bfa' : '#f59e0b'}
        strokeWidth={5}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
    </svg>
  )
}

function ActionIcon({ type, urgent }: { type: NextLoopAction['type']; urgent: boolean }) {
  if (type === 'review-failed') return urgent
    ? <XCircle className="h-5 w-5 text-red-400" />
    : <Loader2 className="h-5 w-5 text-violet-400 animate-spin" />
  if (type === 'start-delegation') return <Play className="h-5 w-5 text-emerald-400" />
  if (type === 'check-pr') return <CheckCircle2 className="h-5 w-5 text-blue-400" />
  if (type === 'all-done') return <CheckCircle2 className="h-5 w-5 text-emerald-400" />
  return <Zap className="h-5 w-5 text-slate-500" />
}

export function AutonomousLoopPanel() {
  const [data, setData] = useState<LoopResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/loop')
      if (res.ok) setData(await res.json() as LoopResponse)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const isActive = data?.stats.running ?? 0
    const interval = isActive > 0 ? 8_000 : 30_000
    const id = setInterval(() => void load(), interval)
    return () => clearInterval(id)
  }, [load, data?.stats.running])

  const handleStartNext = async () => {
    setStarting(true)
    try {
      const res = await fetch('/api/delegations/next-safe', { method: 'POST' })
      if (res.ok) await load()
    } catch { /* ignore */ } finally {
      setStarting(false)
    }
  }

  const handleStartLoop = async () => {
    setStarting(true)
    try {
      const res = await fetch('/api/loop/start', { method: 'POST' })
      if (res.ok) await load()
    } catch { /* ignore */ } finally {
      setStarting(false)
    }
  }

  if (loading || !data) {
    return (
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
        <div className="flex items-center gap-2 text-slate-600 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loop-Status wird geladen…
        </div>
      </div>
    )
  }

  const { nextAction, stats } = data
  const done = stats.completed + stats.failed
  const total = stats.total || 1

  const panelBg = nextAction.urgent
    ? 'border-red-700/40 bg-red-950/10'
    : stats.running > 0
    ? 'border-violet-700/30 bg-violet-950/10'
    : stats.allDone && done > 0
    ? 'border-emerald-700/30 bg-emerald-950/10'
    : 'border-white/[0.07] bg-white/[0.025]'

  return (
    <div className={cx('rounded-xl border p-4 space-y-4', panelBg)}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-violet-400" />
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Autonomer Loop
          </span>
        </div>
        <button
          onClick={() => void load()}
          className="text-slate-600 hover:text-slate-400 transition-colors"
          title="Aktualisieren"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Main content: progress + next action */}
      <div className="flex items-center gap-4">
        {/* Progress ring */}
        <div className="relative shrink-0">
          <ProgressRing value={stats.completed} max={Math.max(total, 1)} size={56} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-sm font-bold text-white leading-none">{stats.completed}</span>
            <span className="text-[9px] text-slate-600 leading-none">/{total}</span>
          </div>
        </div>

        {/* Next action */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <ActionIcon type={nextAction.type} urgent={nextAction.urgent} />
            <p className="text-sm font-semibold text-white">{nextAction.label}</p>
            {nextAction.urgent && (
              <span className="text-[10px] font-bold text-red-400 border border-red-700/40 rounded px-1">
                Achtung
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 leading-4 line-clamp-2">
            {nextAction.detail}
          </p>
        </div>
      </div>

      {/* Stats bar */}
      {total > 0 && (
        <div className="flex items-center gap-3 text-[10px]">
          {stats.completed > 0 && (
            <span className="text-emerald-400">✓ {stats.completed} erledigt</span>
          )}
          {stats.running > 0 && (
            <span className="text-violet-300 flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              {stats.running} laufen
            </span>
          )}
          {stats.failed > 0 && (
            <span className="text-red-400">✗ {stats.failed} fehlgeschlagen</span>
          )}
          {stats.pending > 0 && (
            <span className="text-slate-500">{stats.pending} warten</span>
          )}
          {stats.successRate !== null && (
            <span className="ml-auto text-slate-600">{stats.successRate}% Erfolg heute</span>
          )}
        </div>
      )}

      {/* CTA */}
      <div className="flex gap-2">
        {nextAction.type === 'idle' && stats.total === 0 ? (
          <button
            onClick={() => void handleStartLoop()}
            disabled={starting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50 flex-1 justify-center"
          >
            {starting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            {starting ? 'Startet…' : 'Loop starten'}
          </button>
        ) : nextAction.type === 'start-delegation' && (
          <button
            onClick={() => void handleStartNext()}
            disabled={starting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50 flex-1 justify-center"
          >
            {starting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {starting ? 'Startet…' : 'Nächsten Task starten'}
          </button>
        )}
        <Link
          href={nextAction.href}
          className={cx(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition',
            nextAction.type === 'start-delegation'
              ? 'border border-white/[0.07] bg-white/[0.03] text-slate-400 hover:text-slate-200'
              : 'flex-1 justify-center border border-white/[0.08] bg-white/[0.03] text-slate-300 hover:border-violet-500/40 hover:text-violet-300',
          )}
        >
          {nextAction.type === 'start-delegation' ? 'Ansehen' : 'Ansehen'}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* All done banner */}
      {stats.allDone && done > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-700/20 bg-emerald-950/10 px-3 py-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-emerald-300">
              Alle heutigen Tasks abgeschlossen
            </p>
            <Link href="/delegations/plan" className="text-[10px] text-emerald-600 hover:text-emerald-400">
              Neue Aufgabe planen →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
