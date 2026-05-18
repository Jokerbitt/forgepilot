'use client'

import { useEffect, useState } from 'react'
import {
  DollarSign, Cpu, TrendingDown, Activity, BarChart3,
  CheckCircle2, XCircle, Clock, Zap, ChevronRight,
  BookOpen, GraduationCap, Tag,
} from 'lucide-react'
import Link from 'next/link'
import type { Delegation } from '@/lib/models/delegation'
import { cx } from '@/components/ui/primitives'

interface ResearchStats {
  total: number
  completed: number
  running: number
  failed: number
  totalCitations: number
  academicCitations: number
  governmentCitations: number
  avgCitationsPerDoc: number
  academicRatio: number
  totalTokens: number
  topTags: { tag: string; count: number }[]
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModelBreakdown {
  model: string
  runs: number
  totalTokens: number
  savedUsd: number
  isLocal: boolean
}

interface TimePoint {
  date: string
  savedUsd: number
  tokens: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildModelBreakdowns(delegations: Delegation[]): ModelBreakdown[] {
  const map = new Map<string, ModelBreakdown>()
  for (const d of delegations) {
    const cs = d.summaryReport?.costSavings
    if (!cs) continue
    const key = cs.localModel || 'unknown'
    const existing = map.get(key)
    if (existing) {
      existing.runs += 1
      existing.totalTokens += cs.tokensUsed.totalTokens
      existing.savedUsd += cs.savedUsd
    } else {
      map.set(key, {
        model: key,
        runs: 1,
        totalTokens: cs.tokensUsed.totalTokens,
        savedUsd: cs.savedUsd,
        isLocal: true,
      })
    }
  }
  // Claude CLI runs (no costSavings but have actualCostUsd)
  const claudeRuns = delegations.filter(
    d => d.executionRoute !== 'ollama-agent' && d.status === 'completed' && d.actualCostUsd != null,
  )
  if (claudeRuns.length > 0) {
    const totalCost = claudeRuns.reduce((s, d) => s + (d.actualCostUsd ?? 0), 0)
    map.set('claude-cli', {
      model: 'claude-cli',
      runs: claudeRuns.length,
      totalTokens: 0,
      savedUsd: -totalCost,
      isLocal: false,
    })
  }
  return Array.from(map.values()).sort((a, b) => b.savedUsd - a.savedUsd)
}

function buildTimeline(delegations: Delegation[]): TimePoint[] {
  const map = new Map<string, TimePoint>()
  for (const d of delegations) {
    const cs = d.summaryReport?.costSavings
    if (!cs || cs.savedUsd <= 0) continue
    const date = d.updatedAt.slice(0, 10)
    const existing = map.get(date)
    if (existing) {
      existing.savedUsd += cs.savedUsd
      existing.tokens += cs.tokensUsed.totalTokens
    } else {
      map.set(date, { date, savedUsd: cs.savedUsd, tokens: cs.tokensUsed.totalTokens })
    }
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date)).slice(-14)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, color, pulse }: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  color: string
  pulse?: boolean
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">{label}</p>
        <div className={cx('flex h-7 w-7 items-center justify-center rounded-lg', color)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className="flex items-end gap-2">
        <span className={cx('text-2xl font-bold tabular-nums tracking-tight', pulse ? 'text-emerald-400' : 'text-white')}>
          {value}
        </span>
        {sub && <span className="mb-0.5 text-xs text-slate-500">{sub}</span>}
      </div>
    </div>
  )
}

function SavingsBar({ timeline }: { timeline: TimePoint[] }) {
  if (timeline.length === 0) return null
  const max = Math.max(...timeline.map(t => t.savedUsd), 0.0001)
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Ersparnis letzte 14 Tage</p>
      <div className="flex items-end gap-1.5" style={{ height: 80 }}>
        {timeline.map(pt => {
          const pct = Math.round((pt.savedUsd / max) * 100)
          return (
            <div key={pt.date} className="group relative flex flex-1 flex-col items-center justify-end gap-1">
              <div
                className="w-full rounded-t bg-emerald-500/70 transition-all group-hover:bg-emerald-400"
                style={{ height: `${pct}%`, minHeight: 2 }}
              />
              <span className="text-[9px] text-slate-600 rotate-45 origin-left whitespace-nowrap">
                {pt.date.slice(5)}
              </span>
              {/* Tooltip */}
              <div className="pointer-events-none absolute bottom-full mb-1 hidden rounded bg-white/10 px-1.5 py-1 text-[10px] text-white backdrop-blur group-hover:block whitespace-nowrap">
                ${pt.savedUsd.toFixed(4)} · {pt.tokens.toLocaleString('de')} tok
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ModelBreakdownTable({ models }: { models: ModelBreakdown[] }) {
  if (models.length === 0) return null
  const maxSaved = Math.max(...models.map(m => m.savedUsd), 0.0001)
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Modell-Aufschlüsselung</p>
      <div className="space-y-3">
        {models.map(m => (
          <div key={m.model} className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {m.isLocal ? (
                  <Cpu className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Activity className="h-3.5 w-3.5 text-violet-400" />
                )}
                <span className="text-xs font-mono font-medium text-white">{m.model}</span>
                <span className="rounded-full border border-white/[0.08] px-1.5 py-0.5 text-[10px] text-slate-500">
                  {m.runs} Run{m.runs !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-3 text-right">
                {m.totalTokens > 0 && (
                  <span className="text-[11px] font-mono text-slate-400">{m.totalTokens.toLocaleString('de')} tok</span>
                )}
                <span className={cx(
                  'text-xs font-bold tabular-nums',
                  m.savedUsd > 0 ? 'text-emerald-400' : 'text-rose-400',
                )}>
                  {m.savedUsd > 0 ? '+' : ''}${Math.abs(m.savedUsd).toFixed(4)}
                </span>
              </div>
            </div>
            {m.savedUsd > 0 && (
              <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-emerald-500/60"
                  style={{ width: `${(m.savedUsd / maxSaved) * 100}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function RecentRunsTable({ delegations }: { delegations: Delegation[] }) {
  const runs = delegations
    .filter(d => d.status === 'completed' || d.status === 'failed')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 10)

  if (runs.length === 0) return null

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Letzte Runs</p>
      <div className="space-y-0 divide-y divide-white/[0.04]">
        {runs.map(d => {
          const cs = d.summaryReport?.costSavings
          const isOllama = d.executionRoute === 'ollama-agent'
          return (
            <div key={d.id} className="flex items-center gap-3 py-2.5">
              {d.status === 'completed' ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              ) : (
                <XCircle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
              )}
              <div className="min-w-0 flex-1">
                <Link
                  href={`/delegations/${d.id}`}
                  className="block truncate text-sm text-white hover:text-violet-300 transition-colors"
                >
                  {d.title || d.contract.goal.slice(0, 60)}
                </Link>
                <p className="text-[10px] text-slate-600">
                  {new Date(d.updatedAt).toLocaleDateString('de', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                  {' · '}
                  {d.contract.workItemId}
                  {isOllama && <span className="ml-1 text-emerald-600">Ollama</span>}
                </p>
              </div>
              <div className="shrink-0 text-right">
                {cs && cs.savedUsd > 0 ? (
                  <>
                    <p className="text-xs font-bold text-emerald-400">${cs.savedUsd.toFixed(4)}</p>
                    <p className="text-[10px] text-slate-600">{cs.tokensUsed.totalTokens.toLocaleString('de')} tok</p>
                  </>
                ) : d.actualCostUsd != null ? (
                  <p className="text-xs font-mono text-slate-400">${d.actualCostUsd.toFixed(4)}</p>
                ) : (
                  <p className="text-[10px] text-slate-600">—</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [delegations, setDelegations] = useState<Delegation[]>([])
  const [researchStats, setResearchStats] = useState<ResearchStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/delegations').then(r => r.json() as Promise<Delegation[]>),
      fetch('/api/knowledge/research/stats').then(r => r.json() as Promise<ResearchStats>).catch(() => null),
    ]).then(([dels, rs]) => {
      setDelegations(dels)
      setResearchStats(rs)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const completed = delegations.filter(d => d.status === 'completed')
  const failed = delegations.filter(d => d.status === 'failed')
  const ollamaRuns = delegations.filter(d => d.executionRoute === 'ollama-agent' && d.status === 'completed')

  const totalSavedUsd = delegations.reduce((s, d) => s + (d.summaryReport?.costSavings?.savedUsd ?? 0), 0)
  const totalTokens = delegations.reduce((s, d) => s + (d.summaryReport?.costSavings?.tokensUsed.totalTokens ?? 0), 0)
  const totalActualCost = delegations.reduce((s, d) => s + (d.actualCostUsd ?? 0), 0)
  const avgSavingsPerRun = ollamaRuns.length > 0
    ? totalSavedUsd / ollamaRuns.length
    : 0

  const modelBreakdowns = buildModelBreakdowns(delegations)
  const timeline = buildTimeline(delegations)

  if (loading) {
    return (
      <main className="min-h-screen p-6 text-white">
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-white/[0.06]" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl border border-white/[0.07] bg-white/[0.03]" />
            ))}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-6 text-white">
      <div className="mx-auto max-w-5xl space-y-5">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="page-eyebrow">System</p>
            <h1 className="page-title">Cost Analytics</h1>
          </div>
          <Link
            href="/active"
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            Mission Control <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="Gespart gesamt"
            value={`$${totalSavedUsd.toFixed(3)}`}
            sub="vs Claude"
            icon={TrendingDown}
            color="bg-emerald-500/10 text-emerald-400"
            pulse={totalSavedUsd > 0}
          />
          <KpiCard
            label="Token verbraucht"
            value={totalTokens > 0 ? (totalTokens / 1000).toFixed(1) + 'K' : '0'}
            sub="Ollama lokal"
            icon={Cpu}
            color="bg-emerald-500/10 text-emerald-400"
          />
          <KpiCard
            label="Ollama Runs"
            value={String(ollamaRuns.length)}
            sub={`von ${completed.length + failed.length} gesamt`}
            icon={Zap}
            color="bg-violet-500/10 text-violet-400"
          />
          <KpiCard
            label="Ø Ersparnis / Run"
            value={avgSavingsPerRun > 0 ? `$${avgSavingsPerRun.toFixed(4)}` : '—'}
            sub="pro Ollama Run"
            icon={BarChart3}
            color="bg-amber-500/10 text-amber-400"
          />
        </div>

        {/* Secondary KPIs */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2">Tatsächliche Kosten</p>
            <p className="text-xl font-bold tabular-nums text-white">${totalActualCost.toFixed(4)}</p>
            <p className="mt-1 text-[10px] text-slate-600">Claude CLI Runs</p>
          </div>
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2">Completed Runs</p>
            <p className="text-xl font-bold tabular-nums text-emerald-400">{completed.length}</p>
            <p className="mt-1 text-[10px] text-slate-600">{failed.length} fehlgeschlagen</p>
          </div>
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2">Lokale Quote</p>
            <p className="text-xl font-bold tabular-nums text-white">
              {completed.length > 0
                ? Math.round((ollamaRuns.length / completed.length) * 100)
                : 0}%
            </p>
            <p className="mt-1 text-[10px] text-slate-600">Ollama vs gesamt</p>
          </div>
        </div>

        {/* Charts row */}
        <div className="grid gap-4 lg:grid-cols-2">
          <SavingsBar timeline={timeline} />
          <ModelBreakdownTable models={modelBreakdowns} />
        </div>

        {/* Zero-state for empty savings */}
        {totalSavedUsd === 0 && !loading && (
          <div className="flex min-h-32 flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.07] bg-white/[0.02] p-8 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
              <DollarSign className="h-5 w-5 text-slate-500" />
            </div>
            <p className="font-semibold text-white">Noch keine Token-Daten</p>
            <p className="mt-1 text-sm text-slate-500">
              Starte einen Ollama-Agenten um Token-Verbrauch und Ersparnis zu tracken
            </p>
            <Link
              href="/active"
              className="mt-3 flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-sm font-medium text-violet-400 hover:bg-violet-500/20 transition-all"
            >
              <Activity className="h-4 w-4" />
              Mission Control
            </Link>
          </div>
        )}

        {/* Research Platform Stats */}
        {researchStats && researchStats.total > 0 && (
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Research Platform</p>
              <Link href="/knowledge/research" className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors">
                Öffnen <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
                <div className="mb-1 flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-violet-400" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Dokumente</span>
                </div>
                <p className="text-xl font-bold tabular-nums text-white">{researchStats.completed}</p>
                <p className="mt-0.5 text-[10px] text-slate-600">{researchStats.total} total</p>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
                <div className="mb-1 flex items-center gap-1.5">
                  <GraduationCap className="h-3.5 w-3.5 text-violet-400" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Akademisch</span>
                </div>
                <p className="text-xl font-bold tabular-nums text-violet-400">{Math.round(researchStats.academicRatio * 100)}%</p>
                <p className="mt-0.5 text-[10px] text-slate-600">{researchStats.academicCitations + researchStats.governmentCitations} hochwertig</p>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
                <div className="mb-1 flex items-center gap-1.5">
                  <BarChart3 className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Quellen ø</span>
                </div>
                <p className="text-xl font-bold tabular-nums text-white">{researchStats.avgCitationsPerDoc}</p>
                <p className="mt-0.5 text-[10px] text-slate-600">{researchStats.totalCitations} gesamt</p>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
                <div className="mb-1 flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5 text-sky-400" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Tokens</span>
                </div>
                <p className="text-xl font-bold tabular-nums text-white">
                  {researchStats.totalTokens > 0 ? (researchStats.totalTokens / 1000).toFixed(1) + 'K' : '0'}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-600">Claude Opus</p>
              </div>
            </div>
            {researchStats.topTags.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3">
                <Tag className="h-3 w-3 text-slate-600" />
                {researchStats.topTags.slice(0, 6).map(({ tag, count }) => (
                  <span key={tag} className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] text-slate-400">
                    {tag}
                    <span className="text-slate-600">{count}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Recent runs */}
        <RecentRunsTable delegations={delegations} />

        <div className="flex items-center justify-center gap-2 py-2 text-[11px] text-slate-700">
          <Clock className="h-3 w-3" />
          <span>Preisreferenz: Claude Sonnet 4 · $3/1M Input · $15/1M Output</span>
        </div>
      </div>
    </main>
  )
}
