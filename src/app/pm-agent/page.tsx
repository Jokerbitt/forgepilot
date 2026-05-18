'use client'

import { useEffect, useState } from 'react'
import {
  Brain, Play, CheckCircle2, AlertTriangle, ArrowRight,
  ChevronRight, Clock, TrendingUp, Zap, Circle, BarChart3,
  Loader2, Activity,
} from 'lucide-react'
import Link from 'next/link'
import type { PMAgentResult, PMWorkPackageReview, PMNextDelegation, PMPriority } from '@/lib/agent-runner/pm-agent'
import { cx } from '@/components/ui/primitives'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const HEALTH_META = {
  green: { label: 'Gesund', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400' },
  yellow: { label: 'Aufmerksamkeit', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', dot: 'bg-amber-400' },
  red: { label: 'Kritisch', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20', dot: 'bg-rose-400' },
}

const PRIORITY_COLOR: Record<PMPriority, string> = {
  critical: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
  high:     'text-amber-400 border-amber-500/30 bg-amber-500/10',
  medium:   'text-sky-400 border-sky-500/30 bg-sky-500/10',
  low:      'text-slate-400 border-slate-500/30 bg-slate-500/10',
}

const ACTION_LABEL: Record<PMWorkPackageReview['suggestedNextAction'], string> = {
  delegate_now:          '→ Jetzt delegieren',
  delegate_later:        '○ Später',
  needs_clarification:   '? Klärung nötig',
  block_dependency:      '⛔ Wartet auf Abhängigkeit',
  skip:                  '✕ Überspringen',
}

const ACTION_COLOR: Record<PMWorkPackageReview['suggestedNextAction'], string> = {
  delegate_now:        'text-emerald-400',
  delegate_later:      'text-slate-400',
  needs_clarification: 'text-amber-400',
  block_dependency:    'text-rose-400',
  skip:                'text-slate-600',
}

// ─── Components ───────────────────────────────────────────────────────────────

function NextDelegationCard({ item }: { item: PMNextDelegation }) {
  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${
          item.riskClass === 'A' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' :
          item.riskClass === 'B' ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' :
          'border-rose-500/30 bg-rose-500/10 text-rose-400'
        }`}>
          Risk {item.riskClass}
        </span>
        <span className="font-mono text-[11px] text-slate-500">{item.estimatedHours}h</span>
      </div>
      <p className="font-semibold text-white text-sm">{item.title}</p>
      <p className="mt-1 text-xs text-slate-400 leading-relaxed">{item.rationale}</p>
      <Link
        href={`/delegations?new=1&title=${encodeURIComponent(item.title)}`}
        className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
      >
        Delegation erstellen <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  )
}

function ReviewRow({ review }: { review: PMWorkPackageReview }) {
  return (
    <div className="flex items-start gap-3 border-b border-white/[0.04] py-3">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className={cx('rounded-full border px-2 py-0.5 text-[10px] font-bold', PRIORITY_COLOR[review.recommendedPriority])}>
            {review.recommendedPriority}
          </span>
          {review.flags.length > 0 && review.flags.map(f => (
            <span key={f} className="rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-400">
              {f.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
        <p className="text-sm font-medium text-white">{review.title}</p>
        <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{review.reasoning}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className={cx('text-xs font-semibold', ACTION_COLOR[review.suggestedNextAction])}>
          {ACTION_LABEL[review.suggestedNextAction]}
        </p>
        <p className="text-[10px] text-slate-600 mt-0.5">{review.currentStatus}</p>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PMAgentPage() {
  const [plan, setPlan] = useState<PMAgentResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/pm-agent')
      .then(r => r.json())
      .then((d: { plan: PMAgentResult | null }) => {
        setPlan(d.plan)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleRunPMAgent = async () => {
    setRunning(true)
    setError(null)
    try {
      const res = await fetch('/api/pm-agent', { method: 'POST' })
      const data = await res.json() as PMAgentResult & { error?: string }
      if (!res.ok) {
        setError(data.error ?? 'PM-Agent fehlgeschlagen')
      } else {
        setPlan(data)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setRunning(false)
    }
  }

  const health = plan ? HEALTH_META[plan.overallHealth] : null

  return (
    <main className="min-h-screen p-6 text-white">
      <div className="mx-auto max-w-5xl space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="page-eyebrow">Execute</p>
            <h1 className="page-title">PM Agent</h1>
          </div>
          <div className="flex items-center gap-3">
            {plan && (
              <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                <Clock className="h-3 w-3" />
                {new Date(plan.runAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
            <button
              onClick={handleRunPMAgent}
              disabled={running}
              className="flex items-center gap-2 rounded-lg border border-violet-500/40 bg-violet-500/15 px-4 py-2 text-sm font-bold text-violet-300 transition-all hover:bg-violet-500/25 disabled:opacity-40"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              {running ? 'Analysiert…' : 'PM-Agent ausführen'}
            </button>
            <Link href="/active" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-300 transition-colors">
              Mission Control <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <p className="text-sm text-rose-300">{error}</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
          </div>
        )}

        {!loading && !plan && !running && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.07] bg-white/[0.02] p-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10">
              <Brain className="h-7 w-7 text-violet-400" />
            </div>
            <p className="text-lg font-semibold text-white">PM-Agent noch nicht ausgeführt</p>
            <p className="mt-2 max-w-sm text-sm text-slate-400">
              Der PM-Agent analysiert alle Projekte, Meilensteine und Arbeitspakete — und empfiehlt die nächsten Delegationen.
            </p>
            <button
              onClick={handleRunPMAgent}
              disabled={running}
              className="mt-5 flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-500 transition-all disabled:opacity-40"
            >
              <Play className="h-4 w-4" />
              Erste Analyse starten
            </button>
          </div>
        )}

        {running && !plan && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-16 text-center">
            <Brain className="mb-3 h-10 w-10 animate-pulse text-violet-400" />
            <p className="font-semibold text-white">PM-Agent analysiert Projekte…</p>
            <p className="mt-1 text-sm text-slate-400">Liest Briefs, Meilensteine, Arbeitspakete und laufende Delegationen</p>
          </div>
        )}

        {plan && (
          <>
            {/* Health + Summary */}
            <div className={cx('rounded-xl border p-5', health!.bg)}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <span className={cx('flex h-2 w-2 rounded-full', health!.dot)} />
                    <span className={cx('text-xs font-bold uppercase tracking-widest', health!.color)}>
                      Projekt-Gesundheit: {health!.label}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-200">{plan.summary}</p>
                </div>
                <div className="shrink-0 text-right text-[11px] text-slate-600">
                  <p>{plan.reviews.length} Reviews</p>
                  <p>{plan.nextDelegations.length} Empfehlungen</p>
                </div>
              </div>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4 text-center">
                <p className="text-2xl font-bold text-emerald-400">{plan.nextDelegations.length}</p>
                <p className="mt-1 text-[11px] text-slate-500">Sofort delegierbar</p>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4 text-center">
                <p className="text-2xl font-bold text-rose-400">{plan.blockers.length}</p>
                <p className="mt-1 text-[11px] text-slate-500">Blocker</p>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4 text-center">
                <p className="text-2xl font-bold text-white">
                  {plan.reviews.filter(r => r.flags.length > 0).length}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">Risk Flags</p>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
              {/* Left: reviews */}
              <div className="space-y-4">
                {/* Next delegations */}
                {plan.nextDelegations.length > 0 && (
                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-emerald-400" />
                      <p className="text-sm font-bold text-white">Jetzt starten empfohlen</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {plan.nextDelegations.map(item => (
                        <NextDelegationCard key={item.workPackageId} item={item} />
                      ))}
                    </div>
                  </div>
                )}

                {/* All reviews */}
                {plan.reviews.length > 0 && (
                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-slate-500" />
                      <p className="text-sm font-bold text-white">Alle Arbeitspakete bewertet</p>
                    </div>
                    <div className="divide-y divide-transparent">
                      {plan.reviews.map(review => (
                        <ReviewRow key={review.workPackageId} review={review} />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right: recommendations + blockers */}
              <div className="space-y-4">
                {plan.blockers.length > 0 && (
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.04] p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-rose-400" />
                      <p className="text-sm font-bold text-white">Blocker</p>
                    </div>
                    <ul className="space-y-2">
                      {plan.blockers.map((b, i) => (
                        <li key={i} className="text-xs text-rose-300 leading-relaxed">• {b}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {plan.recommendations.length > 0 && (
                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-violet-400" />
                      <p className="text-sm font-bold text-white">Empfehlungen</p>
                    </div>
                    <ul className="space-y-2">
                      {plan.recommendations.map((r, i) => (
                        <li key={i} className="text-xs text-slate-300 leading-relaxed">
                          <span className="mr-1.5 text-violet-400">→</span>{r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Schnelllinks</p>
                  <div className="space-y-2">
                    {[
                      { href: '/project-briefs', label: 'Project Briefs', icon: Activity },
                      { href: '/knowledge/research', label: 'Research Platform', icon: Brain },
                      { href: '/delegations', label: 'Delegation Queue', icon: Zap },
                      { href: '/active', label: 'Mission Control', icon: TrendingUp },
                    ].map(({ href, label, icon: Icon }) => (
                      <Link key={href} href={href} className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-sm text-slate-300 transition-colors hover:border-white/[0.12] hover:text-white">
                        <Icon className="h-3.5 w-3.5 text-slate-500" />
                        {label}
                        <ChevronRight className="ml-auto h-3.5 w-3.5 text-slate-600" />
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 text-[11px] text-slate-700">
                  <Clock className="h-3 w-3" />
                  <span>Letzter Run: {new Date(plan.runAt).toLocaleString('de-DE')}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
