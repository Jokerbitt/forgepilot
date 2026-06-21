'use client'

import { useEffect, useState } from 'react'
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Code2,
  Loader2,
  RefreshCw,
  Sparkles,
  Terminal,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { buttonClassName, cx } from '@/components/ui/primitives'

// Types (minimal, matches API response)
interface SkillMetrics {
  runsCount: number
  avgQualityScore: number
  avgTokensSaved: number
  successRate: number
  trend: 'improving' | 'stable' | 'declining' | 'unknown'
}
interface PromptSkill {
  id: string
  name: string
  version: string
  scope: string
  status: string
  source: string
  description: string
  content: string
  isDynamic: boolean
  tags: string[]
  metrics: SkillMetrics
  updatedAt: string
}
interface SlashCommand {
  id: string
  name: string
  scope: string
  description: string
  usageCount: number
  lastUsedAt?: string
  createdAt: string
}
interface SkillsResponse {
  promptSkills: PromptSkill[]
  slashCommands: SlashCommand[]
  optimizationHint: string
}

export default function SkillsPage() {
  const [data, setData] = useState<SkillsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'prompt' | 'slash'>('prompt')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [optimizing, setOptimizing] = useState(false)
  const [optResult, setOptResult] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/skills')
      if (r.ok) setData(await r.json() as SkillsResponse)
    } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  const runOptimizer = async () => {
    setOptimizing(true)
    setOptResult(null)
    try {
      const r = await fetch('/api/skills/optimize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ autoApply: true, confidenceThreshold: 85 }) })
      const d = await r.json() as { report: { proposals: Array<{ action: string }> }; applied: { applied: number } }
      setOptResult(`${d.report.proposals.length} Vorschläge analysiert · ${d.applied.applied} automatisch angewendet`)
      await load()
    } finally { setOptimizing(false) }
  }

  const trendIcon = (trend: string) => {
    if (trend === 'improving') return <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
    if (trend === 'declining') return <TrendingDown className="h-3.5 w-3.5 text-red-400" />
    return null
  }

  const statusColor = (status: string) =>
    status === 'active' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
      : status === 'draft' ? 'border-amber-500/20 bg-amber-500/10 text-amber-200'
        : status === 'deprecated' ? 'border-red-500/20 bg-red-500/10 text-red-300'
          : 'border-white/[0.08] bg-white/[0.04] text-slate-400'

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/[0.08] px-3 py-1 text-xs font-semibold text-violet-200">
            <Sparkles className="h-3.5 w-3.5" />
            Skill Intelligence
          </div>
          <h1 className="mt-3 text-2xl font-semibold text-white">Skills & Wissensmanagement</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Prompt-Skills werden in Agent-Runs injiziert und lernen aus jedem Ergebnis.
            Slash Commands sind interaktive Tools für Claude Code. Beide werden automatisch optimiert.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => void runOptimizer()}
            disabled={optimizing}
            className={buttonClassName('secondary', 'gap-2 disabled:opacity-50')}
          >
            {optimizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Optimieren
          </button>
          <button onClick={() => void load()} disabled={loading} className={buttonClassName('ghost', 'w-10 disabled:opacity-50')}>
            <RefreshCw className={cx('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Optimization hint */}
      {(data?.optimizationHint || optResult) && (
        <div className="mt-4 rounded-xl border border-violet-500/20 bg-violet-500/[0.06] px-4 py-3 text-sm text-violet-200">
          <Zap className="mr-2 inline h-4 w-4" />
          {optResult ?? data?.optimizationHint}
        </div>
      )}

      {/* Stats row */}
      {data && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Prompt Skills" value={data.promptSkills.length} />
          <StatCard label="Aktiv" value={data.promptSkills.filter(s => s.status === 'active').length} />
          <StatCard label="Slash Commands" value={data.slashCommands.length} />
          <StatCard label="Ø Qualität" value={
            data.promptSkills.length
              ? Math.round(data.promptSkills.filter(s => s.metrics.runsCount > 0).reduce((a, s) => a + s.metrics.avgQualityScore, 0) / Math.max(1, data.promptSkills.filter(s => s.metrics.runsCount > 0).length))
              : 0
          } suffix="/100" />
        </div>
      )}

      {/* Tabs */}
      <div className="mt-6 flex gap-1 rounded-xl border border-white/[0.08] bg-slate-950 p-1 w-fit">
        {[
          { key: 'prompt', label: 'Prompt Skills', icon: Bot },
          { key: 'slash', label: 'Slash Commands', icon: Terminal },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as 'prompt' | 'slash')}
            className={cx(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition',
              tab === t.key ? 'bg-violet-600 text-white' : 'text-slate-500 hover:text-slate-300',
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="mt-8 flex justify-center text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : tab === 'prompt' ? (
        <div className="mt-4 space-y-3">
          {(data?.promptSkills ?? []).map(skill => (
            <div key={skill.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
              <button
                className="w-full px-4 py-4 flex items-center gap-3 text-left hover:bg-white/[0.02] transition"
                onClick={() => setExpanded(expanded === skill.id ? null : skill.id)}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-white">/{skill.name}</span>
                    <span className={cx('rounded-full border px-2 py-0.5 text-[11px] font-semibold', statusColor(skill.status))}>
                      {skill.status}
                    </span>
                    <span className="rounded-full border border-white/[0.07] bg-white/[0.03] px-2 py-0.5 text-[11px] text-slate-500">
                      {skill.scope}
                    </span>
                    {skill.isDynamic && (
                      <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[11px] text-blue-300">
                        dynamic
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500 truncate">{skill.description}</p>
                </div>
                <div className="flex shrink-0 items-center gap-4 text-xs text-slate-500">
                  {skill.metrics.runsCount > 0 && (
                    <>
                      <div className="flex items-center gap-1">
                        {trendIcon(skill.metrics.trend)}
                        <span className="text-white font-semibold">{skill.metrics.avgQualityScore}</span>/100
                      </div>
                      <span>{skill.metrics.runsCount} runs</span>
                    </>
                  )}
                  {expanded === skill.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </button>

              {expanded === skill.id && (
                <div className="border-t border-white/[0.06] px-4 pb-4">
                  <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                    <MiniStat label="Qualität" value={skill.metrics.avgQualityScore > 0 ? `${skill.metrics.avgQualityScore}/100` : '—'} />
                    <MiniStat label="Erfolgsrate" value={skill.metrics.runsCount > 0 ? `${Math.round(skill.metrics.successRate * 100)}%` : '—'} />
                    <MiniStat label="Token-Einsparung" value={skill.metrics.avgTokensSaved > 0 ? `~${skill.metrics.avgTokensSaved}` : '—'} />
                  </div>
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-slate-500 mb-2">Inhalt (wird in Agent-Prompt injiziert)</p>
                    <pre className="rounded-lg border border-white/[0.07] bg-black/30 p-3 text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap">{skill.content}</pre>
                  </div>
                  {skill.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {skill.tags.map(tag => (
                        <span key={tag} className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] text-slate-500">#{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {(data?.promptSkills ?? []).length === 0 && (
            <div className="rounded-xl border border-dashed border-white/[0.08] py-8 text-center text-sm text-slate-500">
              Keine Prompt Skills. Klicke &quot;Optimieren&quot; um Built-in Skills zu initialisieren.
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {(data?.slashCommands ?? []).map(cmd => (
            <div key={cmd.id} className="flex items-center gap-4 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
              <Code2 className="h-4 w-4 shrink-0 text-violet-400" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">/{cmd.name}</span>
                  <span className={cx(
                    'rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                    cmd.scope === 'global'
                      ? 'border-violet-500/20 bg-violet-500/10 text-violet-200'
                      : 'border-blue-500/20 bg-blue-500/10 text-blue-200',
                  )}>
                    {cmd.scope}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500 truncate">{cmd.description}</p>
              </div>
              <div className="text-xs text-slate-600">
                {cmd.usageCount > 0 ? `${cmd.usageCount}× genutzt` : 'Noch nicht genutzt'}
              </div>
            </div>
          ))}

          {(data?.slashCommands ?? []).length === 0 && (
            <div className="rounded-xl border border-dashed border-white/[0.08] py-8 text-center text-sm text-slate-500">
              Keine Slash Commands gefunden.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, suffix = '' }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/20 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}{suffix}</p>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <p className="text-[11px] text-slate-600">{label}</p>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
  )
}
