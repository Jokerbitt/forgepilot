'use client'

/**
 * /morning — Daily Loop Kickoff Page
 *
 * The first thing you see when opening ForgePilot in the morning.
 * Shows: what happened yesterday, what's ready today, and the one next action.
 * One click to start the day's loop.
 */

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Play,
  RefreshCw,
  Sparkles,
  XCircle,
  Zap,
} from 'lucide-react'
import { cx } from '@/components/ui/primitives'
import { RunnerReadinessBanner } from '@/components/shared/RunnerReadinessBanner'
import type { NextLoopAction, LoopStats } from '@/lib/delegations/loop-closure'

interface DailyData {
  briefing?: string
  nextAction: NextLoopAction
  stats: LoopStats
  readinessScore?: number
  completedYesterday?: number
  failedYesterday?: number
  prsMergedYesterday?: number
}

// ─── Yesterday summary from storage ──────────────────────────────────────────

function YesterdayCard({ data }: { data: DailyData }) {
  const hasActivity = (data.completedYesterday ?? 0) > 0 ||
    (data.failedYesterday ?? 0) > 0 ||
    (data.prsMergedYesterday ?? 0) > 0

  if (!hasActivity) return null

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Gestern</p>
      <div className="flex gap-4 flex-wrap">
        {(data.completedYesterday ?? 0) > 0 && (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="text-sm text-slate-300">
              {data.completedYesterday} erledigt
            </span>
          </div>
        )}
        {(data.prsMergedYesterday ?? 0) > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-emerald-400">⎇</span>
            <span className="text-sm text-slate-300">
              {data.prsMergedYesterday} PR{data.prsMergedYesterday! > 1 ? 's' : ''} gemergt
            </span>
          </div>
        )}
        {(data.failedYesterday ?? 0) > 0 && (
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-400" />
            <span className="text-sm text-red-300">
              {data.failedYesterday} fehlgeschlagen
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Next action card ─────────────────────────────────────────────────────────

function NextActionCard({
  action,
  onStart,
  starting,
}: {
  action: NextLoopAction
  onStart: () => void
  starting: boolean
}) {
  const isUrgent = action.urgent
  const canStart = action.type === 'start-delegation'

  const bg = isUrgent
    ? 'border-red-700/40 bg-red-950/10'
    : canStart
    ? 'border-violet-700/40 bg-violet-950/10'
    : action.type === 'all-done'
    ? 'border-emerald-700/40 bg-emerald-950/10'
    : 'border-white/[0.07] bg-white/[0.025]'

  return (
    <div className={cx('rounded-xl border p-5 space-y-4', bg)}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
          {isUrgent ? '⚠ Handlungsbedarf' : '▶ Nächste Aktion'}
        </p>
        <h2 className="text-xl font-bold text-white leading-tight">{action.label}</h2>
        <p className="text-sm text-slate-400 mt-1 leading-5">{action.detail}</p>
      </div>

      <div className="flex gap-3">
        {canStart && (
          <button
            onClick={onStart}
            disabled={starting}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-bold text-white transition hover:bg-violet-500 disabled:opacity-50"
          >
            {starting ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Startet…</>
            ) : (
              <><Play className="h-4 w-4" />Jetzt starten</>
            )}
          </button>
        )}
        <Link
          href={action.href}
          className={cx(
            'inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition',
            canStart
              ? 'border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-white'
              : 'flex-1 justify-center border-violet-700/40 bg-violet-950/10 text-violet-300 hover:bg-violet-950/20',
          )}
        >
          {canStart ? 'Detail' : action.label}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}

// ─── Today's queue preview ────────────────────────────────────────────────────

function TodayStats({ stats }: { stats: LoopStats }) {
  if (stats.total === 0) return null

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Heute</p>
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Erledigt', value: stats.completed, color: 'text-emerald-400' },
          { label: 'Laufen', value: stats.running, color: 'text-violet-300' },
          { label: 'Wartend', value: stats.pending, color: 'text-slate-400' },
          { label: 'Fehlschl.', value: stats.failed, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="text-center">
            <p className={cx('text-2xl font-bold', s.color)}>{s.value}</p>
            <p className="text-[10px] text-slate-600 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
      {stats.successRate !== null && (
        <div className="mt-3 pt-3 border-t border-white/[0.05]">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600">Erfolgsrate heute</span>
            <span className={cx('font-semibold',
              stats.successRate >= 80 ? 'text-emerald-400' :
              stats.successRate >= 50 ? 'text-amber-400' : 'text-red-400',
            )}>
              {stats.successRate}%
            </span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-white/[0.06]">
            <div
              className={cx('h-full rounded-full transition-all',
                stats.successRate >= 80 ? 'bg-emerald-500' :
                stats.successRate >= 50 ? 'bg-amber-500' : 'bg-red-500',
              )}
              style={{ width: `${stats.successRate}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MorningPage() {
  const router = useRouter()
  const [data, setData] = useState<DailyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)

  const load = useCallback(async () => {
    try {
      const [loopRes, assistantRes] = await Promise.all([
        fetch('/api/loop'),
        fetch('/api/daily-assistant'),
      ])
      const loop = loopRes.ok ? await loopRes.json() as { nextAction: NextLoopAction; stats: LoopStats } : null
      const assistant = assistantRes.ok ? await assistantRes.json() as {
        briefing?: string
        readinessScore?: number
        todayStats?: {
          completedToday: number
          prToday: number
          qualityPassRate: number | null
        }
      } : null

      if (loop) {
        setData({
          briefing: assistant?.briefing,
          nextAction: loop.nextAction,
          stats: loop.stats,
          readinessScore: assistant?.readinessScore,
          completedYesterday: 0, // Would need yesterday's data endpoint
          failedYesterday: 0,
          prsMergedYesterday: assistant?.todayStats?.prToday ?? 0,
        })
      }
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const handleStart = async () => {
    setStarting(true)
    try {
      const res = await fetch('/api/delegations/next-safe', { method: 'POST' })
      if (res.ok) {
        const data = await res.json() as { delegation?: { id: string }; started?: boolean }
        if (data.started && data.delegation?.id) {
          router.push(`/delegations/${data.delegation.id}`)
          return
        }
      }
      await load()
    } catch { /* ignore */ } finally {
      setStarting(false)
    }
  }

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Guten Morgen'
    if (h < 18) return 'Guten Tag'
    return 'Guten Abend'
  })()

  return (
    <main className="min-h-screen bg-[#08080d] px-5 py-6 text-slate-100 lg:px-8">
      <div className="mx-auto max-w-2xl space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-600 uppercase tracking-wide">Daily Loop</p>
            <h1 className="text-2xl font-bold text-white mt-0.5">{greeting} 👋</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void load()}
              disabled={loading}
              className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-2 text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={cx('h-4 w-4', loading && 'animate-spin')} />
            </button>
            <Link href="/" className="rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors">
              Command Center
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 text-slate-500 text-sm py-8 justify-center">
            <Loader2 className="h-5 w-5 animate-spin" />
            Lade Tagesstatus…
          </div>
        ) : data ? (
          <>
            {/* AI Briefing */}
            {data.briefing && (
              <div className="rounded-xl border border-violet-700/30 bg-violet-950/10 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-violet-400" />
                  <span className="text-xs font-semibold text-violet-400 uppercase tracking-wide">Briefing</span>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed">{data.briefing}</p>
              </div>
            )}

            {/* Runner readiness */}
            <RunnerReadinessBanner detailed={false} />

            {/* Main next action */}
            <NextActionCard
              action={data.nextAction}
              onStart={handleStart}
              starting={starting}
            />

            {/* Yesterday */}
            <YesterdayCard data={data} />

            {/* Today stats */}
            <TodayStats stats={data.stats} />

            {/* Quick links */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Delegationen', href: '/delegations', icon: '📋' },
                { label: 'Plan Mode', href: '/delegations/plan', icon: '🗺' },
                { label: 'Live View', href: '/live', icon: '📡' },
              ].map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex flex-col items-center gap-1 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 text-center transition hover:border-violet-500/30 hover:bg-violet-950/10"
                >
                  <span className="text-xl">{link.icon}</span>
                  <span className="text-xs text-slate-400">{link.label}</span>
                </Link>
              ))}
            </div>

            {/* Loop mode indicator */}
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Zap className="h-3.5 w-3.5" />
              <span>
                {data.stats.running > 0
                  ? `${data.stats.running} Agent${data.stats.running > 1 ? 'en laufen' : ' läuft'} gerade`
                  : data.nextAction.type === 'all-done'
                  ? 'Alle Aufgaben abgeschlossen — neuen Plan starten'
                  : 'Loop bereit'}
              </span>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-red-800/30 bg-red-950/10 p-4 text-sm text-red-300">
            Daten konnten nicht geladen werden.
          </div>
        )}
      </div>
    </main>
  )
}
