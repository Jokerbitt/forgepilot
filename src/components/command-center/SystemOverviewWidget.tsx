'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { AgentRun } from '@/lib/models/agent-run'
import type { MemoryCard, KnowledgeSource } from '@/lib/knowledge/types'
import type { ContextPackage } from '@/lib/context-packages/types'
import { cx } from '@/components/ui/primitives'

interface ModuleStat {
  label: string
  count: number
  href: string
  subtext?: string
  tone?: 'neutral' | 'good' | 'warn'
}

export function SystemOverviewWidget() {
  const [stats, setStats] = useState<ModuleStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.allSettled([
      fetch('/api/agent-runs').then(r => r.json()) as Promise<AgentRun[]>,
      fetch('/api/knowledge/cards').then(r => r.json()) as Promise<MemoryCard[]>,
      fetch('/api/knowledge/sources').then(r => r.json()) as Promise<KnowledgeSource[]>,
      fetch('/api/context-packages').then(r => r.json()) as Promise<ContextPackage[]>,
    ]).then(([runs, cards, sources, pkgs]) => {
      const runsData = runs.status === 'fulfilled' && Array.isArray(runs.value) ? runs.value : []
      const cardsData = cards.status === 'fulfilled' && Array.isArray(cards.value) ? cards.value : []
      const sourcesData = sources.status === 'fulfilled' && Array.isArray(sources.value) ? sources.value : []
      const pkgsData = pkgs.status === 'fulfilled' && Array.isArray(pkgs.value) ? pkgs.value : []

      const completedRuns = runsData.filter(r => r.status === 'completed').length
      const staleSources = sourcesData.filter(s => s.isStale).length

      setStats([
        {
          label: 'Agent Runs',
          count: runsData.length,
          href: '/agent-runs',
          subtext: completedRuns > 0 ? `${completedRuns} abgeschlossen` : undefined,
          tone: completedRuns > 0 ? 'good' : 'neutral',
        },
        {
          label: 'Memory Cards',
          count: cardsData.length,
          href: '/knowledge',
          subtext: sourcesData.length > 0 ? `${sourcesData.length} Quellen` : undefined,
          tone: staleSources > 0 ? 'warn' : 'neutral',
        },
        {
          label: 'Context Packages',
          count: pkgsData.length,
          href: '/context-packages',
          subtext: pkgsData.length > 0
            ? `Ø ${Math.round(pkgsData.reduce((s, p) => s + p.readinessScore, 0) / pkgsData.length)}% Readiness`
            : undefined,
          tone: pkgsData.length > 0 ? 'good' : 'neutral',
        },
      ])
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return null
  if (stats.every(s => s.count === 0)) return null

  return (
    <section className="mb-5">
      <div className="grid grid-cols-3 gap-3">
        {stats.map(stat => (
          <Link
            key={stat.label}
            href={stat.href}
            className="group rounded-xl border border-slate-800 bg-slate-900 p-3 transition-colors hover:border-slate-700"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 group-hover:text-slate-400">
              {stat.label}
            </p>
            <p className={cx(
              'mt-1 text-2xl font-bold tabular-nums',
              stat.tone === 'good' ? 'text-emerald-400' :
              stat.tone === 'warn' ? 'text-amber-300' : 'text-white'
            )}>
              {stat.count}
            </p>
            {stat.subtext && (
              <p className="mt-0.5 text-xs text-slate-600">{stat.subtext}</p>
            )}
          </Link>
        ))}
      </div>
    </section>
  )
}
