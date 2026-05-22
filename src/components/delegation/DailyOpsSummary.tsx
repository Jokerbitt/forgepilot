'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import type { Delegation } from '@/lib/models/delegation'
import { cx } from '@/components/ui/primitives'

interface OpsSummary {
  completedToday: number
  failedToday: number
  running: number
  pendingDecisions: number
  totalCostUsd: number
  budgetWarnCount: number
  avgCriticScore: number | null
}

function buildSummary(delegations: Delegation[]): OpsSummary {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayMs = todayStart.getTime()

  const completedToday = delegations.filter(
    d => d.status === 'completed' && new Date(d.updatedAt).getTime() >= todayMs
  ).length

  const failedToday = delegations.filter(
    d => d.status === 'failed' && new Date(d.updatedAt).getTime() >= todayMs
  ).length

  const running = delegations.filter(d => d.status === 'running').length

  const pendingDecisions = delegations.filter(
    d => d.status === 'pending' && d.contract.requiresApproval !== false
  ).length

  const totalCostUsd = delegations.reduce((s, d) => s + (d.actualCostUsd ?? 0), 0)

  const budgetWarnCount = delegations.filter(d => {
    if (!d.actualCostUsd || !d.contract.maxBudgetUsd) return false
    return d.actualCostUsd / d.contract.maxBudgetUsd >= 0.8
  }).length

  const scored = delegations.filter(d => d.criticScore != null)
  const avgCriticScore = scored.length > 0
    ? Math.round(
        scored.reduce((s, d) => {
          const sc = d.criticScore!
          return s + (sc.correctness + sc.efficiency + (100 - sc.drift)) / 3
        }, 0) / scored.length
      )
    : null

  return { completedToday, failedToday, running, pendingDecisions, totalCostUsd, budgetWarnCount, avgCriticScore }
}

function buildNarrative(s: OpsSummary): string {
  const parts: string[] = []

  if (s.running > 0) {
    parts.push(`${s.running} Agent${s.running === 1 ? '' : 'en'} läuft gerade`)
  }

  if (s.completedToday > 0) {
    parts.push(`${s.completedToday} heute erledigt`)
  }

  if (s.failedToday > 0) {
    parts.push(`${s.failedToday} fehlgeschlagen`)
  }

  if (s.pendingDecisions > 0) {
    parts.push(`${s.pendingDecisions} braucht Freigabe`)
  }

  if (s.budgetWarnCount > 0) {
    parts.push(`${s.budgetWarnCount} nahe Budget-Limit`)
  }

  if (s.totalCostUsd > 0) {
    parts.push(`$${s.totalCostUsd.toFixed(2)} verbraucht`)
  }

  if (s.avgCriticScore != null) {
    parts.push(`Ø Score ${s.avgCriticScore}/100`)
  }

  if (parts.length === 0) {
    return 'Keine aktiven Delegationen. Bereit für neue Aufgaben.'
  }

  return parts.join(' · ')
}

interface Props {
  delegations: Delegation[]
  className?: string
}

/**
 * M259 — Compact daily ops summary strip for Mission Control.
 * Rule-based, no AI call. Shows key metrics as a single scannable line.
 */
export function DailyOpsSummary({ delegations, className }: Props) {
  const [summary, setSummary] = useState<OpsSummary | null>(null)

  useEffect(() => {
    setSummary(buildSummary(delegations))
  }, [delegations])

  if (!summary) return null

  const narrative = buildNarrative(summary)
  const hasWarnings = summary.failedToday > 0 || summary.budgetWarnCount > 0 || summary.pendingDecisions > 0

  return (
    <div
      className={cx(
        'flex items-center gap-3 rounded-xl border px-4 py-3',
        hasWarnings
          ? 'border-amber-800/30 bg-amber-950/10'
          : 'border-white/[0.07] bg-white/[0.02]',
        className,
      )}
    >
      <Sparkles className={cx('h-4 w-4 shrink-0', hasWarnings ? 'text-amber-400' : 'text-violet-400')} />
      <p className="flex-1 text-sm text-slate-300">{narrative}</p>
      {summary.pendingDecisions > 0 && (
        <Link
          href="/delegations?approval=approval-required"
          className="shrink-0 rounded-lg border border-amber-700/40 bg-amber-950/20 px-2.5 py-1 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-950/40"
        >
          {summary.pendingDecisions} freigeben →
        </Link>
      )}
    </div>
  )
}
