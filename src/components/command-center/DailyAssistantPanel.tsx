'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Bot, CheckCircle2, Clock3, Loader2, Play, RefreshCw, ShieldAlert, Sparkles } from 'lucide-react'
import { buttonClassName, cx } from '@/components/ui/primitives'
import {
  buildDailyAssistantAction,
  canStartAutonomously,
  describeAutonomy,
  sortAssistantQueue,
  type DailyAssistantQueueItem,
} from '@/lib/daily-assistant/next-action'

interface DelegationStats {
  pending?: number
  approved?: number
  running?: number
  failed?: number
  prOpen?: number
  prMerged?: number
}

interface DailyReport {
  dailyAssistant?: {
    status?: 'ready' | 'attention' | 'blocked'
    score?: number
    nextFocus?: string
  }
  status?: {
    operations?: {
      authDisabled?: boolean
      storageMode?: string
    }
  }
}

interface SettingsResponse {
  approvalMode?: string
  autopilotMinScore?: number
  autopilotMaxRiskClass?: 'A' | 'B' | 'C'
  maxConcurrentAgents?: number
}

interface DelegationResponse {
  id: string
  title?: string
  status: DailyAssistantQueueItem['status']
  updatedAt: string
  contract?: {
    goal?: string
    riskClass?: DailyAssistantQueueItem['riskClass']
    requiresApproval?: boolean
  }
}

interface AssistantSnapshot {
  stats: DelegationStats
  report: DailyReport
  settings: SettingsResponse
  queue: DailyAssistantQueueItem[]
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
      const [stats, report, settings] = await Promise.all([
        fetchJson<DelegationStats>('/api/delegations/stats'),
        fetchJson<DailyReport>('/api/reports/daily'),
        fetchJson<SettingsResponse>('/api/settings'),
      ])
      const delegations = await fetchJson<DelegationResponse[]>('/api/delegations?statuses=failed,running,approved,pending&limit=12')
      setSnapshot({
        stats,
        report,
        settings,
        queue: sortAssistantQueue(delegations.map(delegation => ({
          id: delegation.id,
          title: delegation.title || delegation.contract?.goal || delegation.id,
          status: delegation.status,
          riskClass: delegation.contract?.riskClass ?? 'A',
          requiresApproval: delegation.contract?.requiresApproval,
          updatedAt: delegation.updatedAt,
        }))).slice(0, 6),
      })
    } catch {
      setError('Daily Assistant konnte den aktuellen Stand gerade nicht laden.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const assistantInput = useMemo(() => {
    const stats = snapshot?.stats ?? {}
    const operations = snapshot?.report.status?.operations
    return {
      pending: stats.pending ?? 0,
      approved: stats.approved ?? 0,
      running: stats.running ?? 0,
      failed: stats.failed ?? 0,
      prOpen: stats.prOpen ?? 0,
      prMerged: stats.prMerged ?? 0,
      authDisabled: operations?.authDisabled ?? false,
      storageMode: operations?.storageMode,
      nextFocus: snapshot?.report.dailyAssistant?.nextFocus,
      approvalMode: snapshot?.settings.approvalMode ?? 'balanced',
    }
  }, [snapshot])

  const action = buildDailyAssistantAction(assistantInput)
  const autonomyText = describeAutonomy(assistantInput)
  const score = snapshot?.report.dailyAssistant?.score ?? 0
  const autonomousCount = (snapshot?.queue ?? []).filter(item => canStartAutonomously(item, assistantInput.approvalMode)).length
  const approvalMode = snapshot?.settings.approvalMode ?? 'balanced'
  const autopilotMinScore = snapshot?.settings.autopilotMinScore ?? 85
  const autopilotMaxRiskClass = snapshot?.settings.autopilotMaxRiskClass ?? 'A'
  const maxConcurrentAgents = snapshot?.settings.maxConcurrentAgents ?? 2

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
            {assistantInput.prMerged} PRs gemergt · {assistantInput.failed} Fehler · {assistantInput.running} aktiv
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <Metric label="Wartet" value={assistantInput.pending} />
        <Metric label="Bereit" value={assistantInput.approved} />
        <Metric label="Aktiv" value={assistantInput.running} />
        <Metric label="Offene PRs" value={assistantInput.prOpen} />
      </div>

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
            {snapshot.queue.map(item => (
              <Link
                key={item.id}
                href={`/delegations/${item.id}`}
                className="flex flex-col gap-2 rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-3 transition hover:border-violet-500/30 hover:bg-violet-500/[0.05] sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <StatusPill status={item.status} />
                    <span className="rounded-full border border-white/[0.07] bg-white/[0.04] px-2 py-0.5 text-[11px] font-semibold text-slate-400">
                      Risk {item.riskClass}
                    </span>
                    {canStartAutonomously(item, assistantInput.approvalMode) && (
                      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
                        Autonom möglich
                      </span>
                    )}
                  </span>
                  <span className="mt-2 block truncate text-sm font-semibold text-slate-100">{item.title}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  Öffnen
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            ))}
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

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Link href={action.href} className={buttonClassName('primary', 'min-h-11 flex-1')}>
          {action.primaryLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
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
