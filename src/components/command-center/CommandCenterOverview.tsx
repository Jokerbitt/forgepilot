'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import type { Delegation } from '@/lib/models/delegation'
import type { OperatorReadiness, ReadinessStatus } from '@/lib/operator/readiness'
import type { WorkItem } from '@/lib/models/work-item'
import type { ResearchDocument } from '@/lib/models/research'
import type { PMAgentResult } from '@/lib/agent-runner/pm-agent'
import type { DashboardStats } from '@/app/api/dashboard/stats/route'
import type { IdeaHistoryEntry } from '@/lib/pilot/idea-history-store'
import { Badge, Panel, StatusDot, buttonClassName, cx } from '@/components/ui/primitives'

interface RecommendationsResponse {
  recommendations?: WorkItem[]
  total?: number
  errors?: string[]
}

type ActionTone = 'ready' | 'attention' | 'blocked'

interface NextAction {
  label: string
  title: string
  detail: string
  href: string
  actionLabel: string
  tone: ActionTone
}

export function CommandCenterOverview() {
  const [readiness, setReadiness] = useState<OperatorReadiness | null>(null)
  const [delegations, setDelegations] = useState<Delegation[]>([])
  const [recommendations, setRecommendations] = useState<WorkItem[]>([])
  const [researchDocs, setResearchDocs] = useState<ResearchDocument[]>([])
  const [pmPlan, setPmPlan] = useState<PMAgentResult | null | undefined>(undefined)
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null)
  const [ideaHistory, setIdeaHistory] = useState<IdeaHistoryEntry[]>([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [readinessRes, delegationsRes, recommendationsRes, researchRes, pmRes, statsRes, ideaHistoryRes] = await Promise.allSettled([
        fetch('/api/operator/readiness').then(res => res.json() as Promise<OperatorReadiness>),
        fetch('/api/delegations').then(res => res.json() as Promise<Delegation[]>),
        fetch('/api/recommendations').then(res => res.json() as Promise<RecommendationsResponse>),
        fetch('/api/knowledge/research').then(res => res.json() as Promise<ResearchDocument[]>),
        fetch('/api/pm-agent').then(res => res.json() as Promise<{ plan: PMAgentResult | null }>),
        fetch('/api/dashboard/stats').then(res => res.json() as Promise<DashboardStats>),
        fetch('/api/pilot/idea-history?limit=5').then(res => res.json() as Promise<IdeaHistoryEntry[]>),
      ])

      if (cancelled) return

      if (readinessRes.status === 'fulfilled') setReadiness(readinessRes.value)
      if (delegationsRes.status === 'fulfilled' && Array.isArray(delegationsRes.value)) setDelegations(delegationsRes.value)
      if (recommendationsRes.status === 'fulfilled') setRecommendations(recommendationsRes.value.recommendations ?? [])
      if (researchRes.status === 'fulfilled' && Array.isArray(researchRes.value)) setResearchDocs(researchRes.value)
      if (pmRes.status === 'fulfilled') setPmPlan(pmRes.value.plan)
      if (statsRes.status === 'fulfilled') setDashboardStats(statsRes.value)
      if (ideaHistoryRes.status === 'fulfilled' && Array.isArray(ideaHistoryRes.value)) setIdeaHistory(ideaHistoryRes.value)
    }

    load()
    const interval = window.setInterval(load, 15000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [])

  const active = delegations.filter(item => item.status === 'running')
  const researchCompleted = researchDocs.filter(d => d.status === 'completed').length
  const researchRunning = researchDocs.filter(d => d.status === 'running').length
  const approvals = delegations.filter(item => item.status === 'pending' && item.contract.requiresApproval)
  const approved = delegations.filter(item => item.status === 'approved')
  const failed = delegations.filter(item => item.status === 'failed')
  const topRecommendation = recommendations[0]

  const nextAction = useMemo<NextAction>(() => {
    if (failed.length > 0) {
      return {
        label: 'Blocker',
        title: `${failed.length} Delegation${failed.length === 1 ? '' : 'en'} brauchen Klärung`,
        detail: 'Fehler in der Queue blockieren Vertrauen in autonome Arbeit. Zuerst Ursache prüfen, dann neu starten oder verwerfen.',
        href: '/delegations?status=failed',
        actionLabel: 'Fehler prüfen',
        tone: 'blocked',
      }
    }

    if (approvals.length > 0) {
      return {
        label: 'Entscheidung',
        title: `${approvals.length} Freigabe${approvals.length === 1 ? '' : 'n'} wartet`,
        detail: 'Hier liegt der schnellste Hebel: geprüfte Aufgaben freigeben, damit Agenten weiterarbeiten können.',
        href: '/delegations?approval=approval-required',
        actionLabel: 'Freigaben prüfen',
        tone: 'attention',
      }
    }

    if (approved.length > 0) {
      return {
        label: 'Startbereit',
        title: `${approved.length} Delegation${approved.length === 1 ? '' : 'en'} kann gestartet werden`,
        detail: 'Die Arbeit ist vorbereitet. Starte die nächste Aufgabe, solange der Kontext frisch ist.',
        href: '/delegations?status=approved',
        actionLabel: 'Queue öffnen',
        tone: 'attention',
      }
    }

    if (readiness?.nextActions[0]) {
      const action = readiness.nextActions[0]
      return {
        label: statusLabel(action.status),
        title: action.label,
        detail: action.detail,
        href: action.actionHref ?? '/settings',
        actionLabel: action.actionLabel ?? 'Prüfen',
        tone: action.status,
      }
    }

    if (topRecommendation) {
      return {
        label: 'Nächster Schritt',
        title: topRecommendation.title,
        detail: topRecommendation.blocked
          ? 'Diese Aufgabe ist relevant, hat aber noch Blocker. Vor Delegation kurz prüfen.'
          : 'Das ist aktuell die stärkste Next Best Action aus dem Backlog.',
        href: '/delegations?new=1',
        actionLabel: 'Delegieren',
        tone: topRecommendation.blocked ? 'attention' : 'ready',
      }
    }

    return {
      label: 'Bereit',
      title: 'Keine dringende Aktion offen',
      detail: 'System wirkt ruhig. Lege eine neue Idee an oder prüfe die Projekt-Briefs, wenn du weiter planen möchtest.',
      href: '/project-briefs',
      actionLabel: 'Briefs öffnen',
      tone: 'ready',
    }
  }, [approved.length, approvals.length, failed.length, readiness, topRecommendation])

  const attentionItems = [
    failed.length > 0 ? {
      label: 'Fehler',
      value: failed.length,
      detail: 'Delegationen mit fehlgeschlagenem Lauf',
      href: '/delegations?status=failed',
      tone: 'blocked' as const,
    } : null,
    approvals.length > 0 ? {
      label: 'Freigaben',
      value: approvals.length,
      detail: 'Aufgaben warten auf Entscheidung',
      href: '/delegations?approval=approval-required',
      tone: 'attention' as const,
    } : null,
    approved.length > 0 ? {
      label: 'Startbereit',
      value: approved.length,
      detail: 'Genehmigt, aber noch nicht gestartet',
      href: '/delegations?status=approved',
      tone: 'attention' as const,
    } : null,
    readiness && readiness.status !== 'ready' ? {
      label: 'System',
      value: readiness.score,
      detail: `${readiness.nextActions.length} Readiness-Hinweis${readiness.nextActions.length === 1 ? '' : 'e'}`,
      href: '/settings',
      tone: readiness.status as ActionTone,
    } : null,
  ].filter(Boolean)

  const todayItems = recommendations.slice(0, 3)

  return (
    <div className="space-y-5">
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel className={cx('overflow-hidden border p-6', toneBorder(nextAction.tone))}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Badge tone={badgeTone(nextAction.tone)}>{nextAction.label}</Badge>
              <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-white">{nextAction.title}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">{nextAction.detail}</p>
            </div>
            <a href={nextAction.href} className={buttonClassName(nextAction.tone === 'blocked' ? 'destructive' : 'primary', 'shrink-0')}>
              {nextAction.actionLabel}
            </a>
          </div>
        </Panel>

        <Panel className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Heute</p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <MiniMetric label="Aktiv" value={active.length} tone={active.length > 0 ? 'ready' : 'neutral'} />
            <MiniMetric label="Freigabe" value={approvals.length} tone={approvals.length > 0 ? 'attention' : 'neutral'} />
            <MiniMetric label="Fehler" value={failed.length} tone={failed.length > 0 ? 'blocked' : 'neutral'} />
          </div>
          {(researchCompleted > 0 || researchRunning > 0) && (
            <a href="/knowledge/research" className="mt-3 flex items-center justify-between rounded-lg border border-violet-500/20 bg-violet-500/[0.05] px-3 py-2 text-xs transition-colors hover:border-violet-500/40">
              <span className="text-slate-400">Research-Dokumente</span>
              <span className="flex items-center gap-2 font-semibold text-violet-400">
                {researchRunning > 0 && (
                  <span className="text-[10px] text-amber-400">{researchRunning} läuft</span>
                )}
                {researchCompleted}
              </span>
            </a>
          )}
          <div className="mt-5 border-t border-slate-800 pt-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-400">Systemstatus</span>
              <span className="flex items-center gap-2 font-medium text-white">
                <StatusDot tone={readiness?.status === 'ready' ? 'success' : readiness?.status === 'blocked' ? 'danger' : 'warning'} />
                {readiness ? statusLabel(readiness.status) : 'Lädt'}
              </span>
            </div>
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Attention</p>
              <h2 className="mt-1 text-lg font-semibold text-white">Nur was Sven entscheiden muss</h2>
            </div>
            <a href="/delegations" className={buttonClassName('ghost')}>Queue öffnen</a>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {attentionItems.length > 0 ? (
              attentionItems.filter((item): item is NonNullable<typeof item> => item !== null).map(item => (
                <a
                  key={item.label}
                  href={item.href}
                  className={cx('rounded-lg border bg-slate-950 p-4 transition-colors hover:border-slate-600', toneBorder(item.tone))}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{item.label}</p>
                    <Badge tone={badgeTone(item.tone)}>{item.value}</Badge>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-500">{item.detail}</p>
                </a>
              ))
            ) : (
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 md:col-span-3">
                <p className="text-sm font-semibold text-white">Keine akute Aufmerksamkeit nötig</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">Freigaben, Fehler und Startblocker sind aktuell ruhig.</p>
              </div>
            )}
          </div>
        </Panel>

        <Panel className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">System</p>
          <div className="mt-4 space-y-3">
            <SystemLine label="Connectoren" status={readinessStatusForCheck(readiness, 'connector')} href="/settings" />
            <SystemLine label="Lokale KI" status={readinessStatusForCheck(readiness, 'ai-provider')} href="/settings" />
            <SystemLine label="Workflows" status={readinessStatusForCheck(readiness, 'workflow')} href="/settings" />
          </div>
        </Panel>
      </section>

      <Panel className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Heute relevant</p>
            <h2 className="mt-1 text-lg font-semibold text-white">Maximal drei Vorschläge</h2>
          </div>
          <a href="/project-briefs" className={buttonClassName('secondary')}>Briefs ansehen</a>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {todayItems.length > 0 ? (
            todayItems.map(item => (
              <div key={item.id} className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                <div className="flex items-center justify-between gap-3">
                  <Badge tone={item.blocked ? 'warning' : 'info'}>{item.source}</Badge>
                  <span className="text-xs text-slate-500">P{item.priority}</span>
                </div>
                <h3 className="mt-3 line-clamp-2 text-sm font-semibold leading-6 text-white">{item.title}</h3>
                <p className="mt-2 text-xs text-slate-500">{item.projectId}</p>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 lg:col-span-3">
              <p className="text-sm font-semibold text-white">Keine Backlog-Vorschläge geladen</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">Prüfe Connectoren oder lege eine neue Idee an.</p>
            </div>
          )}
        </div>
      </Panel>

      <SystemStatsWidget stats={dashboardStats} />
      <AgentActivityWidget stats={dashboardStats} />
      <PMAgentWidget plan={pmPlan} />
      <QuickActionsPanel activeRunCount={dashboardStats?.orchestrations.running ?? 0} />
      {ideaHistory.length > 0 && <RecentBuildsWidget entries={ideaHistory} />}
    </div>
  )
}

// ─── Agent Activity Widget (M62 / M66) ──────────────────────────────────────

function AgentActivityWidget({ stats }: { stats: DashboardStats | null }) {
  if (!stats) return null

  const { orchestrations, quality, knowledge } = stats
  const runningRuns = orchestrations.recent.filter(r => r.status === 'running')
  const recentFinished = orchestrations.recent.filter(r => r.status === 'done' || r.status === 'failed')

  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">KI-Agenten</p>
          <h2 className="mt-1 text-lg font-semibold text-white">Live Agent Activity</h2>
        </div>
        <div className="flex items-center gap-3">
          {knowledge.recentCards > 0 && (
            <a href="/knowledge" className="text-xs text-violet-400 hover:text-violet-300">
              +{knowledge.recentCards} neue Cards
            </a>
          )}
          <a href="/orchestrations" className={buttonClassName('ghost', 'text-xs')}>Alle Runs →</a>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        {/* Orchestration runs */}
        <div className="space-y-2">
          {runningRuns.length > 0 ? (
            runningRuns.map(run => {
              const pct = run.taskCount > 0 ? Math.round(((run.doneTasks + run.failedTasks) / run.taskCount) * 100) : 0
              return (
                <a key={run.id} href="/orchestrations"
                  className="flex items-center gap-3 rounded-lg border border-sky-800/40 bg-sky-950/20 px-3 py-2.5 transition-colors hover:border-sky-700/50"
                >
                  <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-sky-300 truncate">{run.title}</p>
                    <div className="mt-1 h-1 w-full rounded-full bg-slate-800">
                      <div className="h-1 rounded-full bg-sky-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-slate-500 tabular-nums">{run.doneTasks}/{run.taskCount}</span>
                </a>
              )
            })
          ) : recentFinished.length > 0 ? (
            recentFinished.map(run => (
              <a key={run.id} href="/orchestrations"
                className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 transition-colors hover:border-slate-700"
              >
                <span className={cx('h-2 w-2 rounded-full shrink-0', run.status === 'done' ? 'bg-emerald-400' : 'bg-red-400')} />
                <p className="flex-1 text-xs text-slate-400 truncate">{run.title}</p>
                <span className="text-xs text-slate-600 capitalize">{run.status}</span>
              </a>
            ))
          ) : (
            <div className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-3">
              <p className="text-xs text-slate-500">Keine aktiven Orchestrierungen</p>
              <p className="mt-0.5 text-xs text-slate-600">Starte einen Run über Work Items oder den Auto-Pilot</p>
            </div>
          )}
        </div>

        {/* Quality KPIs */}
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-center">
              <p className={cx('text-xl font-bold tabular-nums', quality.avgScore !== null ? (quality.avgScore >= 80 ? 'text-emerald-400' : quality.avgScore >= 60 ? 'text-amber-400' : 'text-red-400') : 'text-slate-500')}>
                {quality.avgScore ?? '—'}
              </p>
              <p className="text-[10px] text-slate-600 mt-0.5">Ø Score</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-center">
              <p className={cx('text-xl font-bold tabular-nums', quality.improving > 0 ? 'text-emerald-400' : 'text-slate-500')}>{quality.improving}</p>
              <p className="text-[10px] text-slate-600 mt-0.5">↑ Besser</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-center">
              <p className={cx('text-xl font-bold tabular-nums', quality.declining > 0 ? 'text-red-400' : 'text-slate-500')}>{quality.declining}</p>
              <p className="text-[10px] text-slate-600 mt-0.5">↓ Drift</p>
            </div>
          </div>

          {quality.topWarning ? (
            <div className="flex items-start gap-2 rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-2">
              <span className="text-red-400 text-xs mt-0.5 shrink-0">⚠</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-red-300 capitalize">{quality.topWarning.agentType} · {quality.topWarning.skillCategory}</p>
                <p className="text-[10px] text-red-400/70 mt-0.5 truncate">{quality.topWarning.message}</p>
              </div>
              <a href="/agents?tab=performance" className="shrink-0 text-[10px] text-red-500 hover:text-red-400">Review →</a>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-900/20 bg-emerald-950/10 px-3 py-2">
              <span className="text-emerald-400 text-xs">✓</span>
              <p className="text-xs text-emerald-400/80">Alle Agenten stabil — {knowledge.cardCount} Knowledge Cards</p>
            </div>
          )}

          <a href="/agents?tab=performance" className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs transition-colors hover:border-slate-700">
            <span className="text-slate-500">Performance-Dashboard</span>
            <span className="text-slate-600">→</span>
          </a>
        </div>
      </div>
    </Panel>
  )
}

function PMAgentWidget({ plan }: { plan: PMAgentResult | null | undefined }) {
  if (plan === undefined) return null

  if (!plan) {
    return (
      <Panel className="p-5 border border-slate-800">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">PM Agent</p>
            <h2 className="mt-1 text-lg font-semibold text-white">PM-Agent noch nicht ausgeführt</h2>
            <p className="mt-1 text-sm text-slate-400">Analysiere Briefs, Meilensteine und Delegationen automatisch.</p>
          </div>
          <a href="/pm-agent" className={buttonClassName('secondary', 'shrink-0')}>
            PM-Agent starten
          </a>
        </div>
      </Panel>
    )
  }

  const healthBorder = plan.overallHealth === 'green'
    ? 'border-emerald-500/30'
    : plan.overallHealth === 'yellow'
    ? 'border-amber-500/30'
    : 'border-rose-500/30'

  const healthBadgeTone: 'success' | 'warning' | 'danger' =
    plan.overallHealth === 'green' ? 'success' : plan.overallHealth === 'yellow' ? 'warning' : 'danger'

  const healthLabel = plan.overallHealth === 'green' ? 'Gesund' : plan.overallHealth === 'yellow' ? 'Aufmerksamkeit' : 'Kritisch'

  const topDelegations = plan.nextDelegations.slice(0, 2)

  return (
    <Panel className={cx('p-5 border', healthBorder)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">PM Agent</p>
            <Badge tone={healthBadgeTone}>{healthLabel}</Badge>
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-300">{plan.summary}</p>
        </div>
        <a href="/pm-agent" className={buttonClassName('ghost', 'shrink-0 text-xs')}>
          PM-Agent öffnen
        </a>
      </div>

      {topDelegations.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {topDelegations.map(d => (
            <div key={d.workPackageId} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Nächste Delegation</span>
                <span className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
                  Risk {d.riskClass}
                </span>
              </div>
              <p className="mt-1.5 line-clamp-2 text-xs font-semibold text-white">{d.title}</p>
              <p className="mt-1 text-[10px] text-slate-500">~{d.estimatedHours}h</p>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}

function MiniMetric({ label, value, tone }: { label: string; value: number; tone: ActionTone | 'neutral' }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-center">
      <p className={cx('text-2xl font-semibold', valueColor(tone))}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  )
}

function SystemLine({ label, status, href }: { label: string; status: ReadinessStatus | 'loading'; href: string }) {
  return (
    <a href={href} className="flex items-center justify-between gap-3 rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm transition-colors hover:border-slate-600">
      <span className="text-slate-300">{label}</span>
      <span className="flex items-center gap-2 font-medium text-white">
        <StatusDot tone={status === 'ready' ? 'success' : status === 'blocked' ? 'danger' : status === 'loading' ? 'neutral' : 'warning'} />
        {status === 'loading' ? 'Lädt' : statusLabel(status)}
      </span>
    </a>
  )
}

function readinessStatusForCheck(readiness: OperatorReadiness | null, prefix: string): ReadinessStatus | 'loading' {
  if (!readiness) return 'loading'
  const checks = readiness.checks.filter(check => check.id.startsWith(prefix))
  if (checks.some(check => check.status === 'blocked')) return 'blocked'
  if (checks.some(check => check.status === 'attention')) return 'attention'
  return 'ready'
}

function statusLabel(status: ReadinessStatus): string {
  if (status === 'ready') return 'Bereit'
  if (status === 'blocked') return 'Blockiert'
  return 'Aufmerksamkeit'
}

function badgeTone(tone: ActionTone): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (tone === 'ready') return 'success'
  if (tone === 'blocked') return 'danger'
  return 'warning'
}

function toneBorder(tone: ActionTone): string {
  if (tone === 'blocked') return 'border-rose-500/40'
  if (tone === 'attention') return 'border-amber-500/40'
  return 'border-sky-500/30'
}

function RecentBuildsWidget({ entries }: { entries: IdeaHistoryEntry[] }) {
  const statusColor: Record<IdeaHistoryEntry['status'], string> = {
    building:  'text-slate-500 border-slate-700',
    running:   'text-violet-400 border-violet-500/30',
    done:      'text-emerald-400 border-emerald-500/20',
    failed:    'text-rose-400 border-rose-500/20',
  }
  const statusLabel: Record<IdeaHistoryEntry['status'], string> = {
    building: 'Wird gebaut',
    running:  'Läuft',
    done:     'Fertig',
    failed:   'Fehler',
  }

  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent Builds</p>
        <a href="/idea" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
          + Neue Idee →
        </a>
      </div>
      <div className="space-y-2">
        {entries.map(entry => (
          <div key={entry.id} className={cx('flex items-start gap-3 rounded-lg border px-3 py-2.5', statusColor[entry.status])}>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{entry.briefTitle}</p>
              <p className="text-xs text-slate-600 truncate mt-0.5">{entry.idea.slice(0, 60)}{entry.idea.length > 60 ? '…' : ''}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-slate-600">{entry.workItemCount} Items · {entry.taskCount} Tasks</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className={cx('text-xs font-medium', statusColor[entry.status].split(' ')[0])}>
                {entry.status === 'running' && <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />}
                {statusLabel[entry.status]}
              </span>
              <a
                href="/orchestrations"
                className="text-xs text-slate-600 hover:text-violet-400 transition-colors"
              >
                Run →
              </a>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  )
}

function QuickActionsPanel({ activeRunCount }: { activeRunCount: number }) {
  const [pmStatus, setPmStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [pmMessage, setPmMessage] = useState<string | null>(null)
  const [pilotStatus, setPilotStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [pilotMessage, setPilotMessage] = useState<string | null>(null)
  const [pilotRunId, setPilotRunId] = useState<string | null>(null)

  const handleRunPmAgent = useCallback(async () => {
    setPmStatus('loading')
    setPmMessage(null)
    try {
      const res = await fetch('/api/pm-agent', { method: 'POST' })
      const data = await res.json() as { plan?: { overallHealth?: string }; error?: string }
      if (!res.ok || data.error) {
        setPmStatus('error')
        setPmMessage(data.error ?? 'Fehler beim Ausführen des PM-Agenten.')
      } else {
        const health = data.plan?.overallHealth ?? 'unknown'
        const label = health === 'green' ? 'Gesund' : health === 'yellow' ? 'Aufmerksamkeit' : health === 'red' ? 'Kritisch' : health
        setPmStatus('success')
        setPmMessage(`PM-Agent abgeschlossen — Status: ${label}`)
      }
    } catch {
      setPmStatus('error')
      setPmMessage('Netzwerkfehler beim Starten des PM-Agenten.')
    }
    setTimeout(() => { setPmStatus('idle'); setPmMessage(null) }, 5000)
  }, [])

  const handleAutoPilot = useCallback(async () => {
    setPilotStatus('loading')
    setPilotMessage('Erstelle Delegation…')
    setPilotRunId(null)
    try {
      // Step 1: Create delegation + decompose into tasks
      const res = await fetch('/api/pilot/auto-run', { method: 'POST' })
      const data = await res.json() as { run?: { id: string }; delegation?: { title: string }; taskCount?: number; error?: string }
      if (!res.ok || data.error) {
        setPilotStatus('error')
        setPilotMessage(data.error ?? 'Kein delegierbares Work Item gefunden.')
        setTimeout(() => { setPilotStatus('idle'); setPilotMessage(null) }, 6000)
        return
      }

      const runId = data.run?.id
      if (runId) {
        setPilotRunId(runId)
        setPilotMessage(`Starte ${data.taskCount ?? 0} Sub-Tasks…`)

        // Step 2: Fire-and-forget execute — server handles async execution
        void fetch(`/api/agents/orchestrate/${runId}/execute`, { method: 'POST' })
      }

      setPilotStatus('success')
      setPilotMessage(`⚙ "${data.delegation?.title?.slice(0, 35) ?? 'Task'}" läuft (${data.taskCount ?? 0} Tasks)`)
    } catch {
      setPilotStatus('error')
      setPilotMessage('Netzwerkfehler beim Auto-Pilot.')
    }
    setTimeout(() => { setPilotStatus('idle'); setPilotMessage(null); setPilotRunId(null) }, 10000)
  }, [])

  const pmFeedbackColor =
    pmStatus === 'success' ? 'text-emerald-400' :
    pmStatus === 'error'   ? 'text-rose-400' :
    'text-amber-400'

  const pilotFeedbackColor =
    pilotStatus === 'success' ? 'text-emerald-400' :
    pilotStatus === 'error'   ? 'text-rose-400' :
    'text-amber-400'

  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quick Actions</p>
        {activeRunCount > 0 && (
          <a href="/orchestrations" className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
            {activeRunCount} aktiv
          </a>
        )}
      </div>
      <div className="flex flex-wrap gap-3 items-center">
        {/* M67: Idea → Production Entry Point */}
        <a
          href="/idea"
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold bg-violet-600 text-white hover:bg-violet-500 shadow-lg shadow-violet-500/20 transition-colors"
        >
          <span>💡</span> Idee → Produktion
        </a>

        {/* M63: Autonomous Pilot Button */}
        <button
          onClick={() => { void handleAutoPilot() }}
          disabled={pilotStatus === 'loading'}
          className={cx(
            'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            pilotStatus === 'loading'
              ? 'bg-slate-700/40 text-slate-400 cursor-not-allowed'
              : 'bg-slate-700 text-slate-200 hover:bg-slate-600',
          )}
        >
          {pilotStatus === 'loading' ? (
            <><span className="animate-spin">⚙</span> Pilot läuft…</>
          ) : (
            <><span>⚙</span> Auto-Pilot</>
          )}
        </button>

        <a
          href="/knowledge/research?new=1"
          className={buttonClassName('secondary', 'text-sm')}
        >
          + Neue Recherche
        </a>
        <button
          onClick={() => { void handleRunPmAgent() }}
          disabled={pmStatus === 'loading'}
          className={cx(
            buttonClassName('ghost', 'text-sm'),
            pmStatus === 'loading' ? 'opacity-50 cursor-not-allowed' : ''
          )}
        >
          {pmStatus === 'loading' ? '⏳ PM Agent läuft…' : '▶ PM Agent ausführen'}
        </button>

        {pilotMessage && (
          <span className={cx('text-xs', pilotFeedbackColor)}>
            {pilotMessage}
            {pilotRunId && pilotStatus === 'success' && (
              <a href="/orchestrations" className="ml-2 underline text-sky-400">Run ansehen</a>
            )}
          </span>
        )}
        {pmMessage && !pilotMessage && (
          <span className={cx('text-xs', pmFeedbackColor)}>{pmMessage}</span>
        )}
      </div>
    </Panel>
  )
}

// ─── System Stats Widget ─────────────────────────────────────────────────────

function SystemStatsWidget({ stats }: { stats: DashboardStats | null }) {
  if (!stats) return null

  const { system } = stats
  return (
    <Panel className="p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">System — Heute</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <a
          href="/governance"
          className="flex flex-col gap-1 rounded-lg border border-slate-800 bg-slate-950 p-4 transition-colors hover:border-slate-700"
        >
          <p className={cx('text-2xl font-bold tabular-nums', system.aiCallsToday > 0 ? 'text-violet-400' : 'text-slate-500')}>
            {system.aiCallsToday}
          </p>
          <p className="text-xs text-slate-500 uppercase tracking-wide">AI Aufrufe heute</p>
          <p className="text-[10px] text-slate-600">Verarbeitungen (24h)</p>
        </a>

        <a
          href="/settings"
          className="flex flex-col gap-1 rounded-lg border border-slate-800 bg-slate-950 p-4 transition-colors hover:border-slate-700"
        >
          <p className={cx('text-2xl font-bold tabular-nums', system.activeProviders > 0 ? 'text-emerald-400' : 'text-slate-500')}>
            {system.activeProviders}
          </p>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Aktive Provider</p>
          <p className="text-[10px] text-slate-600">mit API Key konfiguriert</p>
        </a>

        <div className="flex flex-col gap-1 rounded-lg border border-emerald-900/30 bg-emerald-950/10 p-4">
          <p className="text-2xl font-bold tabular-nums text-emerald-400">
            {system.testsGreen} <span className="text-sm">✓</span>
          </p>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Tests grün</p>
          <p className="text-[10px] text-slate-600">Vitest — alle bestanden</p>
        </div>
      </div>
    </Panel>
  )
}

function valueColor(tone: ActionTone | 'neutral'): string {
  if (tone === 'blocked') return 'text-rose-300'
  if (tone === 'attention') return 'text-amber-300'
  if (tone === 'ready') return 'text-emerald-300'
  return 'text-slate-400'
}
