'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, GitPullRequest, ShieldCheck, Loader2 } from 'lucide-react'
import { cx } from '@/components/ui/primitives'

interface TodayStats {
  completedToday: number
  prToday: number
  qualityPassRate: number | null
  checksTotal: number
}

interface DailyAssistantSnapshot {
  todayStats?: TodayStats
  stats?: { running: number; pending: number }
}

export function TodayStatsBar() {
  const [data, setData] = useState<TodayStats | null>(null)
  const [running, setRunning] = useState(0)

  useEffect(() => {
    const load = () => {
      fetch('/api/daily-assistant')
        .then(r => r.ok ? r.json() as Promise<DailyAssistantSnapshot> : Promise.resolve(null))
        .then(d => {
          if (d?.todayStats) setData(d.todayStats)
          if (d?.stats?.running !== undefined) setRunning(d.stats.running)
        })
        .catch(() => {})
    }
    load()
    const id = setInterval(load, 10_000)
    return () => clearInterval(id)
  }, [])

  if (!data && running === 0) return null

  const stats = [
    {
      icon: CheckCircle2,
      label: 'Heute abgeschlossen',
      value: data?.completedToday ?? 0,
      href: '/delegations?status=completed',
      color: data && data.completedToday > 0 ? 'text-emerald-400' : 'text-slate-500',
    },
    {
      icon: GitPullRequest,
      label: 'PRs heute',
      value: data?.prToday ?? 0,
      href: '/delegations',
      color: data && data.prToday > 0 ? 'text-violet-400' : 'text-slate-500',
    },
    {
      icon: ShieldCheck,
      label: 'Review-Bestehensrate',
      value: data?.qualityPassRate != null ? `${data.qualityPassRate}%` : '—',
      href: '/delegations',
      color: data?.qualityPassRate != null
        ? data.qualityPassRate >= 80 ? 'text-emerald-400'
          : data.qualityPassRate >= 50 ? 'text-amber-400'
          : 'text-red-400'
        : 'text-slate-500',
    },
  ]

  return (
    <div className="grid grid-cols-3 gap-2">
      {stats.map(s => {
        const Icon = s.icon
        return (
          <Link
            key={s.label}
            href={s.href}
            className="group flex flex-col gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition hover:border-white/[0.12] hover:bg-white/[0.04]"
          >
            <div className="flex items-center gap-1.5">
              <Icon className={cx('h-3.5 w-3.5', s.color)} strokeWidth={2} />
              <span className="text-[10px] font-medium uppercase tracking-wide text-slate-600">{s.label}</span>
            </div>
            <span className={cx('text-xl font-bold tabular-nums', s.color)}>{s.value}</span>
          </Link>
        )
      })}

      {running > 0 && (
        <div className="col-span-3 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
          <span className="text-xs font-medium text-emerald-300">
            {running} Agent{running > 1 ? 'en' : ''} arbeitet{running === 1 ? '' : 'en'} gerade
          </span>
          <Link href="/live" className="ml-auto text-xs text-emerald-400 hover:underline">Live →</Link>
        </div>
      )}
    </div>
  )
}
