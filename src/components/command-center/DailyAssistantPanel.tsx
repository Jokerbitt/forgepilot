'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, Bot, CheckCircle2, Clock3, Layers, Loader2, Play, RefreshCw, ShieldAlert, Sparkles, Zap } from 'lucide-react'
import { buttonClassName, cx } from '@/components/ui/primitives'
import {
  canStartAutonomously,
  type AppBuilderCapability,
  type DailyAssistantAction,
  type DailyAssistantBlocker,
  type DailyAssistantQueueItem,
  type DailyAssistantStep,
} from '@/lib/daily-assistant/next-action'

interface DelegationStats {
  total?: number
  pending?: number
  approved?: number
  running?: number
  failed?: number
  prOpen?: number
  prMerged?: number
}

interface SettingsResponse {
  approvalMode?: string
  autopilotMinScore?: number
  autopilotMaxRiskClass?: 'A' | 'B' | 'C'
  maxConcurrentAgents?: number
}

interface AssistantSnapshot {
  generatedAt: string
  readinessScore: number
  action: DailyAssistantAction
  autonomyText: string
  steps: DailyAssistantStep[]
  blockers: DailyAssistantBlocker[]
  stats: DelegationStats
  settings: SettingsResponse
  queue: DailyAssistantQueueItem[]
  appBuilderCapability?: AppBuilderCapability
}

function toneClasses(tone: 'ready' | 'attention' | 'blocked') {
  if (tone === 'ready') return 'border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-100'
  if (tone === 'blocked') return 'border-red-500/25 bg-red-500/[0.08] text-red-100'
  return 'border-amber-500/25 bg-amber-500/[0.08] text-amber-100'
}

async function fetchJson<T>(href: string): Promise<T> {
  const response = await fetch(href, { cache: 'no-store' })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json() as Promise<T>
}

export function DailyAssistantPanel() {
  const [snapshot, setSnapshot] = useState<AssistantSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [savingMode, setSavingMode] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      setSnapshot(await fetchJson<AssistantSnapshot>('/api/daily-assistant'))
    } catch {
      setError('Daily Assistant konnte den aktuellen Stand gerade nicht laden.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const assistantStats = snapshot?.stats ?? {}
  const action = snapshot?.action ?? {
    id: 'loading',
    title: 'Daily Assistant lädt den aktuellen Stand',
    detail: 'ForgePilot sammelt Projekte, Delegationen, PRs und Blocker.',
    href: '/live',
    primaryLabel: 'Live öffnen',
    tone: 'attention' as const,
  }
  const autonomyText = snapshot?.autonomyText ?? 'Assistant Mode: ForgePilot sammelt den Tagesplan.'
  const score = snapshot?.readinessScore ?? 0
  const autonomousCount = (snapshot?.queue ?? []).filter(item => canStartAutonomously(item, snapshot?.settings.approvalMode)).length
  const approvalMode = snapshot?.settings.approvalMode ?? 'balanced'
  const autopilotMinScore = snapshot?.settings.autopilotMinScore ?? 85
  const autopilotMaxRiskClass = snapshot?.settings.autopilotMaxRiskClass ?? 'A'
  const maxConcurrentAgents = snapshot?.settings.maxConcurrentAgents ?? 2
  const safeStartItems = (snapshot?.queue ?? []).filter(item => item.status === 'approved' && item.riskClass !== 'C')
  const nextSafeStart = safeStartItems[0]

  const runAutopilotOnce = async () => {
    setWorking(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch('/api/autopilot/tick', { method: 'POST' })
      const data = await response.json() as { skipped?: boolean; reason?: string; count?: number; triggered?: string[] }
      if (!response.ok) throw new Error('Autopilot konnte nicht gestartet werden.')
      if (data.skipped) {
        setMessage(`Autopilot wartet: ${data.reason ?? 'nicht aktiv'}.`)
      } else {
        setMessage(data.count && data.count > 0
          ? `Autopilot hat ${data.count} Delegation(en) gestartet.`
          : 'Autopilot hat geprüft: gerade keine passende sichere Aufgabe startbereit.')
      }
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Autopilot konnte nicht ausgeführt werden.')
    } finally {
      setWorking(false)
    }
  }

  const updateApprovalMode = async (mode: 'manual' | 'balanced' | 'autopilot') => {
    setSavingMode(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalMode: mode }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      setMessage(
        mode === 'manual'
          ? 'Kontrollmodus aktiv: ForgePilot schlägt vor, startet aber nichts automatisch.'
          : mode === 'balanced'
            ? 'Balanced Mode aktiv: sichere Arbeit wird vorbereitet, du bestätigst den Start.'
            : 'Autopilot aktiv: sichere freigegebene Aufgaben können automatisch starten.',
      )
      await refresh()
    } catch {
      setError('Autonomie-Modus konnte nicht gespeichert werden.')
    } finally {
      setSavingMode(false)
    }
  }

  const startDelegation = async (id: string, title: string) => {
    setWorking(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch(`/api/delegations/${encodeURIComponent(id)}/start`, { method: 'POST' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      setMessage(`Delegation gestartet: ${title}`)
      await refresh()
    } catch {
      setError('Delegation konnte nicht gestartet werden. Prüfe Logs, Provider und Freigabe.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5 shadow-sm shadow-black/20 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/[0.08] px-3 py-1 text-xs font-semibold text-violet-200">
            <Bot className="h-3.5 w-3.5" />
            Daily Assistant
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
            {action.title}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            {action.detail}
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            {autonomyText}
          </p>
        </div>

        <div className={cx('rounded-xl border px-4 py-3 text-sm', toneClasses(action.tone))}>
          <div className="flex items-center gap-2 font-semibold">
            {action.tone === 'ready' ? <CheckCircle2 className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
            Readiness {score}/100
          </div>
          <p className="mt-1 text-xs opacity-75">
            {assistantStats.prMerged ?? 0} PRs gemergt · {assistantStats.failed ?? 0} Fehler · {assistantStats.running ?? 0} aktiv
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <Metric label="Wartet" value={assistantStats.pending ?? 0} />
        <Metric label="Bereit" value={assistantStats.approved ?? 0} />
        <Metric label="Aktiv" value={assistantStats.running ?? 0} />
        <Metric label="Offene PRs" value={assistantStats.prOpen ?? 0} />
      </div>

      <div className="mt-5 rounded-xl border border-white/[0.07] bg-black/20 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Tagesplan</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Drei klare Schritte statt Rätselraten: was jetzt zählt, was danach kommt und was warten kann.
            </p>
          </div>
          {snapshot?.generatedAt && (
            <span className="text-xs text-slate-600">
              Stand {new Date(snapshot.generatedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {(snapshot?.steps ?? []).map(step => (
            <Link
              key={step.id}
              href={step.href}
              className={cx(
                'rounded-lg border px-3 py-3 transition hover:border-violet-500/30 hover:bg-violet-500/[0.05]',
                step.state === 'now' ? 'border-violet-500/25 bg-violet-500/10' : 'border-white/[0.06] bg-white/[0.025]',
              )}
            >
              <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                {step.state === 'now' ? 'Jetzt' : step.state === 'next' ? 'Danach' : 'Später'}
              </span>
              <p className="mt-2 text-sm font-semibold text-white">{step.title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{step.detail}</p>
              <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-violet-200">
                {step.label}
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          ))}
        </div>
      </div>

      {snapshot?.appBuilderCapability && (
        <AppBuilderBlock capability={snapshot.appBuilderCapability} />
      )}

      <div className="mt-5 rounded-xl border border-white/[0.07] bg-black/20 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Autonomie-Steuerung</h3>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
              Wähle, wie viel ForgePilot selbst übernehmen darf. Risiko C, fehlende Freigaben und Fehler bleiben blockiert.
            </p>
          </div>
          <div className="grid grid-cols-3 rounded-xl border border-white/[0.08] bg-slate-950 p-1">
            {([
              { value: 'manual', label: 'Kontrolle' },
              { value: 'balanced', label: 'Balanced' },
              { value: 'autopilot', label: 'Autopilot' },
            ] as const).map(mode => (
              <button
                key={mode.value}
                type="button"
                onClick={() => void updateApprovalMode(mode.value)}
                disabled={savingMode || loading}
                className={cx(
                  'rounded-lg px-3 py-2 text-xs font-semibold transition disabled:opacity-50',
                  approvalMode === mode.value
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-950/30'
                    : 'text-slate-500 hover:text-slate-300',
                )}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <PolicyCard
            title="Autonom erlaubt"
            body={approvalMode === 'autopilot'
              ? `Risk A-${autopilotMaxRiskClass}, Score ab ${autopilotMinScore}, maximal ${maxConcurrentAgents} parallel.`
              : 'Noch nicht vollautomatisch. ForgePilot empfiehlt und bereitet vor.'}
            tone={approvalMode === 'autopilot' ? 'ready' : 'neutral'}
          />
          <PolicyCard
            title="Immer blockiert"
            body="Risk C, fehlende Review-Freigabe, Fehler, Merge-Konflikte oder unklare Secrets."
            tone="blocked"
          />
          <PolicyCard
            title="Deine Kontrolle"
            body="PRs werden über Review-Checkliste geprüft. Merge bleibt ein bewusster Abschluss."
            tone="attention"
          />
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-white/[0.07] bg-black/20 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Heute erledigen</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Die wichtigsten Aufgaben sind automatisch nach Fehlern, laufender Arbeit, freigegebenem Start und Freigaben sortiert.
            </p>
          </div>
          <span className={cx(
            'rounded-full border px-2.5 py-1 text-xs font-semibold',
            autonomousCount > 0
              ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
              : 'border-white/[0.08] bg-white/[0.04] text-slate-400',
          )}>
            {autonomousCount > 0 ? `${autonomousCount} autonom startbar` : 'Kontrolliert starten'}
          </span>
        </div>

        {loading ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Lade Tagesliste...
          </div>
        ) : snapshot?.queue.length ? (
          <div className="mt-4 space-y-2">
            {snapshot.queue.map(item => {
              const canStartNow = item.status === 'approved' && item.riskClass !== 'C'
              return (
              <div
                key={item.id}
                className="flex flex-col gap-2 rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-3 transition hover:border-violet-500/30 hover:bg-violet-500/[0.05] sm:flex-row sm:items-center sm:justify-between"
              >
                <Link href={`/delegations/${item.id}`} className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <StatusPill status={item.status} />
                    <span className="rounded-full border border-white/[0.07] bg-white/[0.04] px-2 py-0.5 text-[11px] font-semibold text-slate-400">
                      Risk {item.riskClass}
                    </span>
                    {canStartAutonomously(item, approvalMode) && (
                      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
                        Autonom möglich
                      </span>
                    )}
                  </span>
                  <span className="mt-2 block truncate text-sm font-semibold text-slate-100">{item.title}</span>
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  {canStartNow && (
                    <button
                      type="button"
                      onClick={() => void startDelegation(item.id, item.title)}
                      disabled={working}
                      className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-violet-600 px-3 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Starten
                    </button>
                  )}
                  <Link href={`/delegations/${item.id}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                    Öffnen
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            )})}
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-white/[0.08] px-3 py-4 text-sm text-slate-500">
            Keine wartenden Aufgaben. Plane eine neue Idee oder sammle den nächsten Produktivlauf.
          </div>
        )}
      </div>

      {(message || error) && (
        <div className={cx(
          'mt-4 rounded-xl border px-4 py-3 text-sm',
          error ? 'border-red-500/25 bg-red-500/10 text-red-200' : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200',
        )}>
          {error ?? message}
        </div>
      )}

      {snapshot?.blockers?.length ? (
        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
          <h3 className="text-sm font-semibold text-white">Was Autonomie gerade begrenzt</h3>
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {snapshot.blockers.map(blocker => (
              <Link
                key={blocker.id}
                href={blocker.href}
                className={cx(
                  'rounded-lg border px-3 py-2 transition hover:bg-white/[0.04]',
                  blocker.severity === 'critical'
                    ? 'border-red-500/20 bg-red-500/10'
                    : 'border-amber-500/20 bg-amber-500/10',
                )}
              >
                <p className="text-sm font-semibold text-white">{blocker.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">{blocker.detail}</p>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        {action.id === 'start-approved-work' && nextSafeStart ? (
          <button
            type="button"
            onClick={() => void startDelegation(nextSafeStart.id, nextSafeStart.title)}
            disabled={working || loading}
            className={buttonClassName('primary', 'min-h-11 flex-1 disabled:opacity-50')}
          >
            {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Nächste sichere Delegation starten
          </button>
        ) : (
          <Link href={action.href} className={buttonClassName('primary', 'min-h-11 flex-1')}>
            {action.primaryLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
        <Link href="/idea" className={buttonClassName('secondary', 'min-h-11 flex-1')}>
          <Sparkles className="h-4 w-4" />
          Neue Idee planen
        </Link>
        <button
          type="button"
          onClick={() => void runAutopilotOnce()}
          disabled={working || loading}
          className={buttonClassName('secondary', 'min-h-11 flex-1 disabled:opacity-50')}
        >
          {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Autopilot prüfen
        </button>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className={buttonClassName('ghost', 'min-h-11 sm:w-12 disabled:opacity-50')}
          title="Stand neu laden"
        >
          <RefreshCw className={cx('h-4 w-4', loading && 'animate-spin')} />
        </button>
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/20 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  )
}

function PolicyCard({
  title,
  body,
  tone,
}: {
  title: string
  body: string
  tone: 'ready' | 'attention' | 'blocked' | 'neutral'
}) {
  const classes =
    tone === 'ready' ? 'border-emerald-500/20 bg-emerald-500/10'
      : tone === 'attention' ? 'border-amber-500/20 bg-amber-500/10'
        : tone === 'blocked' ? 'border-red-500/20 bg-red-500/10'
          : 'border-white/[0.06] bg-white/[0.025]'
  return (
    <div className={cx('rounded-lg border px-3 py-3', classes)}>
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">{body}</p>
    </div>
  )
}

const LEVEL_COLORS: Record<string, string> = {
  'single-task': 'border-slate-500/25 bg-slate-500/10 text-slate-300',
  'multi-slice-mvp': 'border-blue-500/25 bg-blue-500/10 text-blue-200',
  'large-feature': 'border-violet-500/25 bg-violet-500/10 text-violet-200',
  'full-app': 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200',
}

function AppBuilderBlock({ capability }: { capability: AppBuilderCapability }) {
  const colorClass = LEVEL_COLORS[capability.level] ?? LEVEL_COLORS['single-task']!
  return (
    <div className="mt-5 rounded-xl border border-white/[0.07] bg-black/20 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">App Builder Fähigkeit</h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
            Wie groß kann ForgePilot heute autonom bauen? Basiert auf abgeschlossenen Runs und Autopilot-Status.
          </p>
        </div>
        <span className={cx('shrink-0 rounded-full border px-3 py-1 text-xs font-semibold', colorClass)}>
          {capability.label}
        </span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <Layers className="h-3.5 w-3.5" />
            Max. Phasen
          </div>
          <p className="mt-1 text-2xl font-semibold text-white">{capability.maxPhases}</p>
          <p className="mt-1 text-xs text-slate-500">{capability.detail}</p>
        </div>
        <div className={cx('rounded-lg border px-3 py-3', capability.planModeReady ? 'border-violet-500/20 bg-violet-500/[0.08]' : 'border-white/[0.06] bg-white/[0.025]')}>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <Zap className="h-3.5 w-3.5" />
            Plan Mode
          </div>
          {capability.planModeReady ? (
            <>
              <p className="mt-1 text-sm font-semibold text-white">Bereit — großes Feature starten</p>
              <Link
                href="/delegations/plan"
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-violet-200 hover:text-violet-100"
              >
                Plan Mode öffnen
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm font-semibold text-white">Noch nicht freigeschaltet</p>
              <p className="mt-1 text-xs text-slate-500">
                {capability.recommendedAction === 'fix-blockers'
                  ? 'Behebe zuerst fehlgeschlagene Delegationen.'
                  : 'Schließe mehr Runs erfolgreich ab.'}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: DailyAssistantQueueItem['status'] }) {
  const label =
    status === 'failed' ? 'Fehler'
      : status === 'running' ? 'Läuft'
        : status === 'approved' ? 'Bereit'
          : status === 'pending' ? 'Wartet'
            : status
  const tone =
    status === 'failed' ? 'border-red-500/25 bg-red-500/10 text-red-200'
      : status === 'running' ? 'border-amber-500/25 bg-amber-500/10 text-amber-200'
        : status === 'approved' ? 'border-violet-500/25 bg-violet-500/10 text-violet-200'
          : 'border-white/[0.08] bg-white/[0.04] text-slate-400'
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold', tone)}>
      <Clock3 className="h-3 w-3" />
      {label}
    </span>
  )
}
