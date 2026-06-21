'use client'

import Link from 'next/link'
import { Bot, BrainCircuit, CheckCircle2, CircleDollarSign, Loader2, Radio, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge, Metric, Panel, buttonClassName, cx } from '@/components/ui/primitives'
import type { AgentWorkbenchSummary as AgentWorkbenchSummaryData } from '@/lib/agent-workbench/summary'

type Props = {
  compact?: boolean
}

const toneClass = {
  ready: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200',
  attention: 'border-amber-500/25 bg-amber-500/10 text-amber-200',
  blocked: 'border-rose-500/25 bg-rose-500/10 text-rose-200',
}

const costModeLabel = {
  'local-first': 'lokal zuerst',
  'subscription-first': 'Abo zuerst',
  'metered-controlled': 'kostenkontrolliert',
}

export function AgentWorkbenchSummary({ compact = false }: Props) {
  const [summary, setSummary] = useState<AgentWorkbenchSummaryData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const res = await fetchWithTimeout('/api/agent-workbench/summary', compact ? 8000 : 5000)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json() as AgentWorkbenchSummaryData
        if (active) {
          setSummary(data)
          setError(null)
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Workbench nicht erreichbar')
      }
    }

    void load()
    const interval = window.setInterval(() => void load(), compact ? 20000 : 10000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [compact])

  if (!summary && !error) {
    return (
      <Panel className={cx('p-4', compact && 'p-4')}>
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Agent Workbench wird geladen...
        </div>
      </Panel>
    )
  }

  if (error) {
    return (
      <Panel className="border-rose-500/20 bg-rose-500/[0.05] p-4">
        <p className="text-sm font-semibold text-rose-200">Agent Workbench nicht erreichbar</p>
        <p className="mt-1 text-xs text-rose-200/70">{error}</p>
      </Panel>
    )
  }

  if (!summary) return null

  if (compact) {
    return (
      <Panel className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Agent Workbench</p>
            <h2 className="mt-1 text-base font-semibold text-white">{summary.recommendation.title}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">{summary.recommendation.detail}</p>
          </div>
          <span className={cx('inline-flex shrink-0 items-center rounded-full border px-2 py-1 text-xs font-semibold', toneClass[summary.recommendation.tone])}>
            {summary.work.activeDelegations + summary.work.activeRuns} aktiv
          </span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <MiniMetric label="Agenten" value={summary.agents.total} />
          <MiniMetric label="bereit" value={summary.agents.available} />
          <MiniMetric label="lokal" value={summary.agents.local} />
        </div>
        <Link href={summary.recommendation.href} className={buttonClassName('secondary', 'mt-3 w-full')}>
          {summary.recommendation.actionLabel}
        </Link>
      </Panel>
    )
  }

  return (
    <Panel className="p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/[0.08] px-3 py-1 text-xs font-semibold text-cyan-200">
            <BrainCircuit className="h-3.5 w-3.5" />
            Agent Workbench
          </div>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-white">Spezialisierte KI-Agenten, klar koordiniert</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            ForgePilot verteilt Arbeit auf Planung, Umsetzung, Kritik, Betrieb und Wissen. Lokale Modelle werden bevorzugt,
            teurere oder schreibende Agenten starten nur mit engem Scope und sichtbarer Kontrolle.
          </p>
        </div>
        <Link href={summary.recommendation.href} className={buttonClassName(summary.recommendation.tone === 'blocked' ? 'destructive' : 'primary', 'shrink-0')}>
          {summary.recommendation.actionLabel}
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Agenten-Pool" value={summary.agents.total} detail={`${summary.agents.available} bereit, ${summary.agents.disabled} deaktiviert`} tone="info" />
        <Metric label="Aktive Arbeit" value={summary.work.activeDelegations + summary.work.activeRuns} detail={`${summary.work.approvedDelegations} freigegeben`} tone={summary.work.failedDelegations > 0 ? 'warning' : 'success'} />
        <Metric label="Kostenmodus" value={`${summary.agents.local} lokal`} detail={`${summary.agents.includedSubscription} Abo, ${summary.agents.metered} metered`} tone="cost" />
        <Metric label="Autonomie" value={summary.agents.supervisedWrite} detail={`${summary.agents.proposeOnly} schlagen vor, ${summary.agents.autopilot} autopilot`} tone="privacy" />
      </div>

      <div className={cx('mt-5 rounded-xl border p-4', toneClass[summary.recommendation.tone])}>
        <div className="flex items-start gap-3">
          {summary.recommendation.tone === 'blocked' ? <ShieldCheck className="mt-0.5 h-5 w-5" /> : <CheckCircle2 className="mt-0.5 h-5 w-5" />}
          <div>
            <p className="font-semibold text-white">{summary.recommendation.title}</p>
            <p className="mt-1 text-sm leading-6 opacity-80">{summary.recommendation.detail}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-5">
        {summary.lanes.map(lane => (
          <div key={lane.key} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{lane.label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{lane.description}</p>
              </div>
              <Badge tone={lane.availableCount > 0 ? 'success' : 'warning'}>{lane.availableCount}/{lane.agentCount}</Badge>
            </div>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-black/20 px-2 py-1 text-xs text-slate-400">
              <CircleDollarSign className="h-3.5 w-3.5" />
              {costModeLabel[lane.preferredCostMode]}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_260px]">
        <div className="rounded-xl border border-white/[0.07] bg-black/20 p-4">
          <p className="text-sm font-semibold text-white">Zusammenarbeitsregeln</p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-400">
            {summary.collaborationRules.map(rule => (
              <li key={rule} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-black/20 p-4">
          <p className="text-sm font-semibold text-white">Details</p>
          <div className="mt-3 flex flex-col gap-2">
            <Link href="/agents" className={buttonClassName('secondary', 'justify-start')}>
              <Bot className="h-4 w-4" />
              Agenten ansehen
            </Link>
            <Link href="/delegations" className={buttonClassName('secondary', 'justify-start')}>
              <Radio className="h-4 w-4" />
              Delegationen
            </Link>
          </div>
        </div>
      </div>
    </Panel>
  )
}

async function fetchWithTimeout(href: string, timeoutMs: number): Promise<Response> {
  return await Promise.race([
    fetch(href, { cache: 'no-store' }),
    new Promise<Response>((_, reject) => {
      window.setTimeout(() => reject(new Error(`Timeout nach ${Math.round(timeoutMs / 1000)}s`)), timeoutMs)
    }),
  ])
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  )
}
