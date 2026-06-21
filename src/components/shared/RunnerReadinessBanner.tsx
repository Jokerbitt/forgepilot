'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, XCircle } from 'lucide-react'
import { cx } from '@/components/ui/primitives'
import type { RunnerReadiness, RunnerCheck } from '@/lib/runner-health/runner-detector'

interface Props {
  /** If true, shows full detail list. If false, shows compact summary only. */
  detailed?: boolean
  /** Polling interval in ms — default 0 = no polling */
  pollIntervalMs?: number
}

const STATUS_ICON = {
  ok:      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />,
  warn:    <AlertCircle  className="h-4 w-4 text-amber-400 shrink-0" />,
  error:   <XCircle      className="h-4 w-4 text-red-400 shrink-0" />,
  unknown: <AlertCircle  className="h-4 w-4 text-slate-500 shrink-0" />,
}

const STATUS_ROW_CLASS = {
  ok:      'border-emerald-800/20 bg-emerald-950/10',
  warn:    'border-amber-800/20 bg-amber-950/10',
  error:   'border-red-800/20 bg-red-950/10',
  unknown: 'border-slate-800/20 bg-slate-950/10',
}

function CheckRow({ check }: { check: RunnerCheck }) {
  return (
    <div className={cx('flex items-start gap-2 rounded-lg border px-3 py-2', STATUS_ROW_CLASS[check.status])}>
      {STATUS_ICON[check.status]}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-200">{check.name}</span>
          {check.version && (
            <span className="text-[10px] text-slate-600 font-mono">{check.version}</span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5 leading-4">{check.detail}</p>
        {check.fix && check.status !== 'ok' && (
          <p className="text-xs text-slate-400 mt-1 leading-4">
            <span className="text-slate-600">→</span>{' '}
            {check.fixHref ? (
              <Link href={check.fixHref} className="text-violet-400 hover:underline">
                {check.fix}
              </Link>
            ) : check.fix}
          </p>
        )}
      </div>
    </div>
  )
}

export function RunnerReadinessBanner({ detailed = false, pollIntervalMs = 0 }: Props) {
  const [data, setData] = useState<RunnerReadiness | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = async (silent = false) => {
    if (!silent) setRefreshing(true)
    try {
      const res = await fetch('/api/runner-health')
      if (res.ok) setData(await res.json() as RunnerReadiness)
    } catch { /* ignore */ } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void load(true)
    if (pollIntervalMs > 0) {
      const id = setInterval(() => void load(true), pollIntervalMs)
      return () => clearInterval(id)
    }
  }, [pollIntervalMs])

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Betriebsbereitschaft wird geprüft…
      </div>
    )
  }

  if (!data) return null

  const errorCount = data.checks.filter(c => c.status === 'error').length
  const warnCount  = data.checks.filter(c => c.status === 'warn').length

  const bannerClass = data.ready
    ? errorCount === 0 && warnCount === 0
      ? 'border-emerald-700/30 bg-emerald-950/10'
      : 'border-amber-700/30 bg-amber-950/10'
    : 'border-red-700/30 bg-red-950/10'

  const statusIcon = data.ready
    ? errorCount === 0 && warnCount === 0
      ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
      : <AlertCircle  className="h-4 w-4 text-amber-400 shrink-0" />
    : <XCircle className="h-4 w-4 text-red-400 shrink-0" />

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className={cx('flex items-center gap-2 rounded-xl border px-4 py-3', bannerClass)}>
        {statusIcon}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">{data.summary}</p>
          <p className="text-xs text-slate-500 mt-0.5">{data.executionMode}</p>
        </div>
        <button
          onClick={() => void load()}
          disabled={refreshing}
          className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-1.5 text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-40"
          title="Neu prüfen"
        >
          <RefreshCw className={cx('h-3.5 w-3.5', refreshing && 'animate-spin')} />
        </button>
      </div>

      {/* Detailed checks */}
      {detailed && (
        <div className="space-y-2">
          {data.checks
            .filter(c => c.status !== 'unknown')
            .sort((a, b) => {
              const order = { error: 0, warn: 1, ok: 2 }
              return order[a.status as keyof typeof order] - order[b.status as keyof typeof order]
            })
            .map(check => <CheckRow key={check.id} check={check} />)
          }
        </div>
      )}
    </div>
  )
}
