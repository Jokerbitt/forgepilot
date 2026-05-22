'use client'

import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Activity,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cpu,
  DollarSign,
  GitMerge,
  GraduationCap,
  Server,
  Shield,
  Tag,
  Target,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react'
import Link from 'next/link'
import type { Delegation } from '@/lib/models/delegation'
import { cx } from '@/components/ui/primitives'
import type { CostAnalytics } from '@/lib/analytics/cost-types'
import type { AnalyticsData } from '@/app/api/analytics/route'

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
      map.set(key, { model: key, runs: 1, totalTokens: cs.tokensUsed.totalTokens, savedUsd: cs.savedUsd, isLocal: true })
    }
  }
  const claudeRuns = delegations.filter(d => d.executionRoute !== 'ollama-agent' && d.status === 'completed' && d.actualCostUsd != null)
  if (claudeRuns.length > 0) {
    const totalCost = claudeRuns.reduce((s, d) => s + (d.actualCostUsd ?? 0), 0)
    map.set('claude-cli', { model: 'claude-cli', runs: claudeRuns.length, totalTokens: 0, savedUsd: -totalCost, isLocal: false })
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

function KpiCard({ label, value, sub, icon: Icon, color, pulse }: {
  label: string; value: string; sub?: string; icon: React.ElementType; color: string; pulse?: boolean
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
        <span className={cx('text-2xl font-bold tabular-nums tracking-tight', pulse ? 'text-emerald-400' : 'text-white')}>{value}</span>
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
              <div className="w-full rounded-t bg-emerald-500/70 transition-all group-hover:bg-emerald-400" style={{ height: `${pct}%`, minHeight: 2 }} />
              <span className="text-[9px] text-slate-600 rotate-45 origin-left whitespace-nowrap">{pt.date.slice(5)}</span>
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
                {m.isLocal ? <Cpu className="h-3.5 w-3.5 text-emerald-400" /> : <Activity className="h-3.5 w-3.5 text-violet-400" />}
                <span className="text-xs font-mono font-medium text-white">{m.model}</span>
                <span className="rounded-full border border-white/[0.08] px-1.5 py-0.5 text-[10px] text-slate-500">{m.runs} Run{m.runs !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-3 text-right">
                {m.totalTokens > 0 && <span className="text-[11px] font-mono text-slate-400">{m.totalTokens.toLocaleString('de')} tok</span>}
                <span className={cx('text-xs font-bold tabular-nums', m.savedUsd > 0 ? 'text-emerald-400' : 'text-rose-400')}>
                  {m.savedUsd > 0 ? '+' : ''}${Math.abs(m.savedUsd).toFixed(4)}
                </span>
              </div>
            </div>
            {m.savedUsd > 0 && (
              <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full bg-emerald-500/60" style={{ width: `${(m.savedUsd / maxSaved) * 100}%` }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function CostTrendChart({ data }: { data: AnalyticsData['costTrend'] }) {
  const width = 600
  const height = 120
  const padLeft = 42
  const padRight = 12
  const padTop = 8
  const padBottom = 22
  const innerW = width - padLeft - padRight
  const innerH = height - padTop - padBottom

  const nonZero = data.filter(p => p.actualCostUsd > 0 || p.estimatedCostUsd > 0)
  if (nonZero.length < 2) {
    return (
      <p className="py-4 text-center text-[11px] text-slate-600 italic">Noch keine Kostendaten — führe Delegations aus.</p>
    )
  }

  const maxVal = Math.max(...data.map(p => Math.max(p.actualCostUsd, p.estimatedCostUsd)), 0.0001)
  const xOf  = (i: number) => padLeft + (i / (data.length - 1)) * innerW
  const yOf  = (v: number) => padTop + innerH - (v / maxVal) * innerH

  const toPath = (key: 'actualCostUsd' | 'estimatedCostUsd') =>
    data.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(p[key]).toFixed(1)}`).join(' ')

  const ticks = 4
  const labelIdxs = [0, Math.floor(data.length / 3), Math.floor(2 * data.length / 3), data.length - 1]

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      {/* Y-axis grid + labels */}
      {Array.from({ length: ticks + 1 }).map((_, i) => {
        const v = (maxVal / ticks) * (ticks - i)
        const y = yOf(v)
        return (
          <g key={i}>
            <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
            <text x={padLeft - 4} y={y + 3.5} textAnchor="end" fontSize={8} fill="#64748b">
              ${v < 0.001 ? v.toFixed(5) : v < 0.01 ? v.toFixed(4) : v.toFixed(3)}
            </text>
          </g>
        )
      })}

      {/* X-axis date labels */}
      {labelIdxs.map(i => (
        <text key={i} x={xOf(i)} y={height - 4} textAnchor="middle" fontSize={8} fill="#64748b">
          {data[i]?.date.slice(5)}
        </text>
      ))}

      {/* Estimated line (dashed) */}
      <path d={toPath('estimatedCostUsd')} fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.6} />
      {/* Actual line */}
      <path d={toPath('actualCostUsd')} fill="none" stroke="#10b981" strokeWidth={2} />

      {/* Dots for non-zero actual */}
      {data.map((p, i) => p.actualCostUsd > 0 ? (
        <circle key={i} cx={xOf(i)} cy={yOf(p.actualCostUsd)} r={2.5} fill="#10b981" />
      ) : null)}
    </svg>
  )
}

function RecentRunsTable({ delegations }: { delegations: Delegation[] }) {
  const runs = delegations
    .filter(d => ['completed', 'failed', 'running'].includes(d.status))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 8)
  if (runs.length === 0) return null
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Letzte Runs</p>
      <div className="space-y-2">
        {runs.map(d => {
          const cs = d.summaryReport?.costSavings
          const isOllama = d.executionRoute === 'ollama-agent'
          return (
            <Link key={d.id} href={`/delegations/${d.id}`} className="flex items-center gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-sm hover:border-white/[0.08] transition-colors">
              {d.status === 'completed' ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" /> : d.status === 'failed' ? <XCircle className="h-3.5 w-3.5 shrink-0 text-rose-400" /> : <Zap className="h-3.5 w-3.5 shrink-0 text-amber-400 animate-pulse" />}
              <span className="flex-1 truncate text-slate-300">{d.title}</span>
              <span className={cx('shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full border', isOllama ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-violet-500/30 bg-violet-500/10 text-violet-400')}>
                {isOllama ? 'local' : 'cloud'}
              </span>
              {cs && <span className="shrink-0 font-mono text-[11px] text-emerald-400">+${cs.savedUsd.toFixed(4)}</span>}
              {!cs && d.actualCostUsd != null && <span className="shrink-0 font-mono text-[11px] text-rose-400">-${d.actualCostUsd.toFixed(4)}</span>}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ─── M132: AI Cost Analytics ───────────────────────────────────────────────────

function DailyTrendBar({ data }: { data: CostAnalytics['dailyTrend'] }) {
  const maxCost = Math.max(...data.map((d: CostAnalytics['dailyTrend'][0]) => d.totalCostUsd), 0.0001)
  const hasData = data.some((d: CostAnalytics['dailyTrend'][0]) => d.totalCostUsd > 0)
  if (!hasData) return <div className="flex h-20 items-center justify-center text-[11px] text-slate-600">Noch keine AI-Calls aufgezeichnet</div>
  return (
    <div className="flex h-20 items-end gap-0.5">
      {data.map((pt: CostAnalytics['dailyTrend'][0]) => {
        const pct = Math.max(Math.round((pt.totalCostUsd / maxCost) * 100), pt.totalCostUsd > 0 ? 2 : 0)
        return (
          <div key={pt.date} className="group relative flex-1" title={`${pt.date}: $${pt.totalCostUsd.toFixed(5)} (${pt.calls} calls)`}>
            <div style={{ height: `${pct}%` }} className={cx('rounded-sm transition-all', pt.totalCostUsd > 0 ? 'bg-violet-500/60 group-hover:bg-violet-400' : 'bg-white/[0.04]')} />
          </div>
        )
      })}
    </div>
  )
}

function ProviderCostRow({ provider, maxCost }: { provider: CostAnalytics['byProvider'][0]; maxCost: number }) {
  const pct = maxCost > 0 ? (provider.totalCostUsd / maxCost) * 100 : 0
  const rc: Record<string, string> = { eu: 'text-emerald-400', us: 'text-amber-400', local: 'text-sky-400', unknown: 'text-slate-500' }
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-28 shrink-0">
        <p className="truncate text-[11px] font-medium text-slate-300">{provider.providerName}</p>
        <p className={cx('text-[10px]', rc[provider.dataResidency] ?? 'text-slate-500')}>{provider.dataResidency}</p>
      </div>
      <div className="flex-1">
        <div className="h-1.5 rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full bg-violet-500/70" style={{ width: `${Math.max(pct, provider.totalCostUsd > 0 ? 2 : 0)}%` }} />
        </div>
      </div>
      <div className="w-24 text-right">
        <p className="text-[11px] tabular-nums text-slate-300">${provider.totalCostUsd < 0.0001 ? '< 0.0001' : provider.totalCostUsd.toFixed(4)}</p>
        <p className="text-[10px] text-slate-600">{provider.calls} calls</p>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [delegations, setDelegations] = useState<Delegation[]>([])
  const [researchStats, setResearchStats] = useState<ResearchStats | null>(null)
  const [costAnalytics, setCostAnalytics] = useState<CostAnalytics | null>(null)
  const [executionAnalytics, setExecutionAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/delegations').then(r => r.json() as Promise<Delegation[]>),
      fetch('/api/knowledge/research/stats').then(r => r.json() as Promise<ResearchStats>).catch(() => null),
      fetch('/api/analytics/costs').then(r => r.json() as Promise<CostAnalytics>).catch(() => null),
      fetch('/api/analytics').then(r => r.json() as Promise<AnalyticsData>).catch(() => null),
    ]).then(([dels, rs, ca, ea]) => {
      setDelegations(dels)
      setResearchStats(rs)
      setCostAnalytics(ca)
      setExecutionAnalytics(ea)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const completed = delegations.filter(d => d.status === 'completed')
  const failed = delegations.filter(d => d.status === 'failed')
  const ollamaRuns = delegations.filter(d => d.executionRoute === 'ollama-agent' && d.status === 'completed')
  const totalSavedUsd = delegations.reduce((s, d) => s + (d.summaryReport?.costSavings?.savedUsd ?? 0), 0)
  const totalTokens = delegations.reduce((s, d) => s + (d.summaryReport?.costSavings?.tokensUsed.totalTokens ?? 0), 0)

  // PR lifecycle metrics (M267)
  const prCreated = delegations.filter(d => d.summaryReport?.prUrl).length
  const prMerged  = delegations.filter(d => d.summaryReport?.prState === 'merged').length
  const prOpen    = delegations.filter(d => d.summaryReport?.prUrl && (!d.summaryReport.prState || d.summaryReport.prState === 'open')).length
  const mergeRate = prCreated > 0 ? Math.round((prMerged / prCreated) * 100) : null
  const totalActualCost = delegations.reduce((s, d) => s + (d.actualCostUsd ?? 0), 0)
  const avgSavingsPerRun = ollamaRuns.length > 0 ? totalSavedUsd / ollamaRuns.length : 0
  const modelBreakdowns = buildModelBreakdowns(delegations)
  const timeline = buildTimeline(delegations)

  if (loading) {
    return (
      <main className="min-h-screen p-6 text-white">
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-white/[0.06]" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl border border-white/[0.07] bg-white/[0.03]" />)}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-6 text-white">
      <div className="mx-auto max-w-5xl space-y-5">

        <div className="flex items-center justify-between">
          <div>
            <p className="page-eyebrow">System</p>
            <h1 className="page-title">Cost Analytics</h1>
          </div>
          <Link href="/active" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-300 transition-colors">
            Mission Control <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* ── M132: AI Provider Cost Analytics ─────────────────────────────── */}
        {costAnalytics && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
                <div className="mb-2 flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-violet-400" />
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">AI-Kosten gesamt</p>
                </div>
                <p className="text-xl font-bold tabular-nums text-white">
                  {costAnalytics.totals.costUsd < 0.001 && costAnalytics.totals.costUsd > 0 ? `< $0.001` : `$${costAnalytics.totals.costUsd.toFixed(4)}`}
                </p>
                <p className="mt-1 text-[10px] text-slate-600">{costAnalytics.totals.calls.toLocaleString()} API-Calls</p>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
                <div className="mb-2 flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-amber-400" />
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Monat geschätzt</p>
                </div>
                <p className="text-xl font-bold tabular-nums text-amber-400">${costAnalytics.totals.estimatedMonthlyCostUsd.toFixed(2)}</p>
                <p className="mt-1 text-[10px] text-slate-600">basierend auf 30 Tagen</p>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
                <div className="mb-2 flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5 text-sky-400" />
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Input-Tokens</p>
                </div>
                <p className="text-xl font-bold tabular-nums text-white">
                  {costAnalytics.totals.inputTokens >= 1_000_000 ? `${(costAnalytics.totals.inputTokens / 1_000_000).toFixed(1)}M` : costAnalytics.totals.inputTokens > 0 ? `${(costAnalytics.totals.inputTokens / 1000).toFixed(1)}K` : '0'}
                </p>
                <p className="mt-1 text-[10px] text-slate-600">DSGVO-Ledger (letzte 2000)</p>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
                <div className="mb-2 flex items-center gap-1.5">
                  {costAnalytics.budgetUtilization.delegationsExceeded > 0 ? <AlertTriangle className="h-3.5 w-3.5 text-red-400" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Budget</p>
                </div>
                <p className={cx('text-xl font-bold tabular-nums', costAnalytics.budgetUtilization.delegationsExceeded > 0 ? 'text-red-400' : 'text-emerald-400')}>
                  {costAnalytics.budgetUtilization.utilizationPct.toFixed(0)}%
                </p>
                <p className="mt-1 text-[10px] text-slate-600">
                  {costAnalytics.budgetUtilization.delegationsExceeded > 0 ? `${costAnalytics.budgetUtilization.delegationsExceeded} überschritten` : `${costAnalytics.budgetUtilization.delegationsWithBudget} Delegations`}
                </p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Server className="h-4 w-4 text-slate-500" />
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Kosten nach Provider</p>
                </div>
                {costAnalytics.byProvider.length === 0 ? (
                  <p className="py-4 text-center text-[11px] text-slate-600">Keine Provider-Daten</p>
                ) : (
                  <div className="divide-y divide-white/[0.04]">
                    {costAnalytics.byProvider.slice(0, 6).map((p: CostAnalytics['byProvider'][0]) => (
                      <ProviderCostRow key={p.providerId} provider={p} maxCost={costAnalytics.byProvider[0]?.totalCostUsd ?? 1} />
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-slate-500" />
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Kosten 30 Tage</p>
                  </div>
                  <p className="text-[10px] text-slate-600">
                    ${costAnalytics.dailyTrend.reduce((s: number, d: CostAnalytics['dailyTrend'][0]) => s + d.totalCostUsd, 0).toFixed(4)} total
                  </p>
                </div>
                <DailyTrendBar data={costAnalytics.dailyTrend} />
                <div className="mt-2 flex justify-between text-[10px] text-slate-700">
                  <span>{costAnalytics.dailyTrend[0]?.date}</span>
                  <span>heute</span>
                </div>
              </div>
            </div>

            {costAnalytics.byPurpose.length > 0 && (
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-5">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Kosten nach Zweck</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {costAnalytics.byPurpose.slice(0, 8).map((p: CostAnalytics['byPurpose'][0]) => (
                    <div key={p.purpose} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                      <p className="truncate text-[10px] text-slate-500">{p.purpose.replace('generateText:', '')}</p>
                      <p className="mt-1 font-mono text-[11px] font-medium text-white">
                        ${p.totalCostUsd < 0.0001 ? '< 0.0001' : p.totalCostUsd.toFixed(4)}
                      </p>
                      <p className="text-[10px] text-slate-600">{p.calls} calls</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* KPI cards — Ollama savings */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard label="Gespart gesamt" value={`$${totalSavedUsd.toFixed(3)}`} sub="vs Claude" icon={TrendingDown} color="bg-emerald-500/10 text-emerald-400" pulse={totalSavedUsd > 0} />
          <KpiCard label="Token verbraucht" value={totalTokens > 0 ? (totalTokens / 1000).toFixed(1) + 'K' : '0'} sub="Ollama lokal" icon={Cpu} color="bg-emerald-500/10 text-emerald-400" />
          <KpiCard label="Ollama Runs" value={String(ollamaRuns.length)} sub={`von ${completed.length + failed.length} gesamt`} icon={Zap} color="bg-violet-500/10 text-violet-400" />
          <KpiCard label="Ø Ersparnis / Run" value={avgSavingsPerRun > 0 ? `$${avgSavingsPerRun.toFixed(4)}` : '—'} sub="pro Ollama Run" icon={BarChart3} color="bg-amber-500/10 text-amber-400" />
        </div>

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
            <p className="text-xl font-bold tabular-nums text-white">{completed.length > 0 ? Math.round((ollamaRuns.length / completed.length) * 100) : 0}%</p>
            <p className="mt-1 text-[10px] text-slate-600">Ollama vs gesamt</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <SavingsBar timeline={timeline} />
          <ModelBreakdownTable models={modelBreakdowns} />
        </div>

        {totalSavedUsd === 0 && !loading && (
          <div className="flex min-h-32 flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.07] bg-white/[0.02] p-8 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
              <DollarSign className="h-5 w-5 text-slate-500" />
            </div>
            <p className="font-semibold text-white">Noch keine Token-Daten</p>
            <p className="mt-1 text-sm text-slate-500">Starte einen Ollama-Agenten um Token-Verbrauch und Ersparnis zu tracken</p>
            <Link href="/active" className="mt-3 flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-sm font-medium text-violet-400 hover:bg-violet-500/20 transition-all">
              <Activity className="h-4 w-4" />
              Mission Control
            </Link>
          </div>
        )}

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
                <p className="text-xl font-bold tabular-nums text-white">{researchStats.totalTokens > 0 ? (researchStats.totalTokens / 1000).toFixed(1) + 'K' : '0'}</p>
                <p className="mt-0.5 text-[10px] text-slate-600">Claude Opus</p>
              </div>
            </div>
            {researchStats.topTags.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3">
                <Tag className="h-3 w-3 text-slate-600" />
                {researchStats.topTags.slice(0, 6).map(({ tag, count }) => (
                  <span key={tag} className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] text-slate-400">
                    {tag}<span className="text-slate-600">{count}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <RecentRunsTable delegations={delegations} />

        {/* ── M267: PR Lifecycle Strip ─────────────────────────────────────── */}
        {prCreated > 0 && (
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-5">
            <div className="mb-4 flex items-center gap-2">
              <GitMerge className="h-4 w-4 text-violet-400" />
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Pull Requests</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1">Erstellt</p>
                <p className="text-xl font-bold tabular-nums text-white">{prCreated}</p>
                <p className="mt-0.5 text-[10px] text-slate-600">von {completed.length} Runs</p>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1">Gemergt</p>
                <p className="text-xl font-bold tabular-nums text-violet-400">{prMerged}</p>
                <p className="mt-0.5 text-[10px] text-slate-600">abgeschlossen</p>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1">Offen</p>
                <p className="text-xl font-bold tabular-nums text-amber-400">{prOpen}</p>
                <p className="mt-0.5 text-[10px] text-slate-600">warten auf Review</p>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1">Merge-Rate</p>
                <p className="text-xl font-bold tabular-nums text-emerald-400">{mergeRate !== null ? `${mergeRate}%` : '—'}</p>
                <p className="mt-0.5 text-[10px] text-slate-600">gemergt / erstellt</p>
              </div>
            </div>
          </div>
        )}

        {/* ── M198: Execution Analytics Dashboard ──────────────────────────── */}
        {executionAnalytics && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-t border-white/[0.06] pt-5">
              <Target className="h-4 w-4 text-slate-500" />
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Execution Analytics</p>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Executions</p>
                <p className="text-2xl font-bold tabular-nums text-white">{executionAnalytics.summary.totalExecutions}</p>
                <p className="mt-0.5 text-[10px] text-slate-600">total</p>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Completed</p>
                <p className="text-2xl font-bold tabular-nums text-emerald-400">{executionAnalytics.summary.completedCount}</p>
                <p className="mt-0.5 text-[10px] text-slate-600">succeeded</p>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Failed</p>
                <p className="text-2xl font-bold tabular-nums text-rose-400">{executionAnalytics.summary.failedCount}</p>
                <p className="mt-0.5 text-[10px] text-slate-600">failed</p>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Success Rate</p>
                <p className={cx('text-2xl font-bold tabular-nums', executionAnalytics.summary.successRate >= 80 ? 'text-emerald-400' : executionAnalytics.summary.successRate >= 50 ? 'text-amber-400' : 'text-rose-400')}>
                  {executionAnalytics.summary.successRate}%
                </p>
                <p className="mt-0.5 text-[10px] text-slate-600">of executions</p>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Avg Cost</p>
                <p className="text-2xl font-bold tabular-nums text-white">${executionAnalytics.summary.avgCostUsd.toFixed(4)}</p>
                <p className="mt-0.5 text-[10px] text-slate-600">per execution</p>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Total Cost</p>
                <p className="text-2xl font-bold tabular-nums text-white">${executionAnalytics.summary.totalCostUsd.toFixed(4)}</p>
                <p className="mt-0.5 text-[10px] text-slate-600">all executions</p>
              </div>
            </div>

            {/* CriticScore breakdown */}
            {(executionAnalytics.criticScores.approvedCount + executionAnalytics.criticScores.needsRevisionCount + executionAnalytics.criticScores.rejectedCount) > 0 && (
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-slate-500" />
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">CriticScore Breakdown</p>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Correctness</p>
                    <p className="text-xl font-bold tabular-nums text-white">{executionAnalytics.criticScores.avgCorrectness}</p>
                    <p className="text-[10px] text-slate-600">avg /100</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Efficiency</p>
                    <p className="text-xl font-bold tabular-nums text-white">{executionAnalytics.criticScores.avgEfficiency}</p>
                    <p className="text-[10px] text-slate-600">avg /100</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Drift</p>
                    <p className="text-xl font-bold tabular-nums text-white">{executionAnalytics.criticScores.avgDrift}</p>
                    <p className="text-[10px] text-slate-600">avg (lower = better)</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Approved</p>
                    <p className="text-xl font-bold tabular-nums text-emerald-400">{executionAnalytics.criticScores.approvedCount}</p>
                    <p className="text-[10px] text-slate-600">verdict</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Needs Revision</p>
                    <p className="text-xl font-bold tabular-nums text-amber-400">{executionAnalytics.criticScores.needsRevisionCount}</p>
                    <p className="text-[10px] text-slate-600">verdict</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Rejected</p>
                    <p className="text-xl font-bold tabular-nums text-rose-400">{executionAnalytics.criticScores.rejectedCount}</p>
                    <p className="text-[10px] text-slate-600">verdict</p>
                  </div>
                </div>
              </div>
            )}

            {/* By-route table */}
            {executionAnalytics.byRoute.length > 0 && (
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-5">
                <div className="mb-4 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-slate-500" />
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Failure Rates by Route</p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-left">
                      <th className="pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Route</th>
                      <th className="pb-2 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-500">Executions</th>
                      <th className="pb-2 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-500">Success Rate</th>
                      <th className="pb-2 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-500">Avg Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {executionAnalytics.byRoute.map(row => (
                      <tr key={row.route}>
                        <td className="py-2.5">
                          <span className="font-mono text-xs text-slate-300">{row.route}</span>
                        </td>
                        <td className="py-2.5 text-right font-mono text-xs text-slate-400">{row.count}</td>
                        <td className="py-2.5 text-right">
                          <span className={cx('font-mono text-xs font-medium', row.successRate >= 80 ? 'text-emerald-400' : row.successRate >= 50 ? 'text-amber-400' : 'text-rose-400')}>
                            {row.successRate}%
                          </span>
                        </td>
                        <td className="py-2.5 text-right font-mono text-xs text-slate-400">
                          {row.avgScore > 0 ? row.avgScore : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 14-day trend */}
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-5">
              <div className="mb-4 flex items-center gap-2">
                <Activity className="h-4 w-4 text-slate-500" />
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">14-Day Execution Trend</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-left">
                    <th className="pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Date</th>
                    <th className="pb-2 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-500">Completed</th>
                    <th className="pb-2 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-500">Failed</th>
                    <th className="pb-2 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-500">Avg Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {executionAnalytics.recentTrend.slice().reverse().map(row => (
                    <tr key={row.date}>
                      <td className="py-2 font-mono text-xs text-slate-400">{row.date}</td>
                      <td className="py-2 text-right">
                        <span className={cx('font-mono text-xs', row.completed > 0 ? 'text-emerald-400' : 'text-slate-600')}>{row.completed}</span>
                      </td>
                      <td className="py-2 text-right">
                        <span className={cx('font-mono text-xs', row.failed > 0 ? 'text-rose-400' : 'text-slate-600')}>{row.failed}</span>
                      </td>
                      <td className="py-2 text-right font-mono text-xs text-slate-400">
                        {row.avgScore > 0 ? row.avgScore : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* M298: 30-Day Cost Trend Line Chart */}
            {executionAnalytics.costTrend.length > 0 && (
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-slate-500" />
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">30-Day Cost Trend</p>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-5 rounded bg-emerald-500" />Tatsächlich</span>
                    <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-5 rounded border-t-2 border-amber-400/60 border-dashed" />Geschätzt</span>
                  </div>
                </div>
                <CostTrendChart data={executionAnalytics.costTrend} />
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-center gap-2 py-2 text-[11px] text-slate-700">
          <Clock className="h-3 w-3" />
          <span>Preisreferenz: Claude Sonnet 4 · $3/1M Input · $15/1M Output</span>
        </div>
      </div>
    </main>
  )
}
