'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Activity, CheckCircle2, Clock3, ExternalLink, GitPullRequest, PlayCircle, RefreshCw, XCircle } from 'lucide-react'
import type { AgentLog, Delegation, DelegationStatus } from '@/lib/models/delegation'
import { Badge, EmptyState, Panel, buttonClassName, cx } from '@/components/ui/primitives'
import { AgentPhaseIndicator } from '@/components/delegation/AgentPhaseIndicator'
import { inferAgentPhase } from '@/lib/delegations/agent-phase'

const REFRESH_MS = 5_000
const MAX_VISIBLE = 8

const statusRank: Record<DelegationStatus, number> = {
  running: 0,
  approved: 1,
  pending: 2,
  failed: 3,
  completed: 4,
  cancelled: 5,
  rejected: 6,
}

const statusLabel: Record<DelegationStatus, string> = {
  pending: 'Wartet',
  approved: 'Bereit',
  running: 'Arbeitet',
  completed: 'Fertig',
  failed: 'Fehler',
  cancelled: 'Abgebrochen',
  rejected: 'Abgelehnt',
}

const statusText: Record<DelegationStatus, string> = {
  pending: 'wartet auf Freigabe oder Start',
  approved: 'ist vorbereitet und kann gestartet werden',
  running: 'arbeitet gerade aktiv an der Aufgabe',
  completed: 'hat die Aufgabe abgeschlossen',
  failed: 'braucht eine Entscheidung oder einen Retry',
  cancelled: 'wurde gestoppt',
  rejected: 'wurde abgelehnt',
}

export function sortLiveDelegations(delegations: Delegation[]): Delegation[] {
  return [...delegations].sort((a, b) => {
    const byStatus = statusRank[a.status] - statusRank[b.status]
    if (byStatus !== 0) return byStatus
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })
}

export function summarizeLiveActivity(delegations: Delegation[]) {
  return delegations.reduce(
    (summary, delegation) => {
      summary.total += 1
      if (delegation.status === 'running') summary.running += 1
      if (delegation.status === 'approved') summary.ready += 1
      if (delegation.status === 'failed') summary.failed += 1
      if (delegation.status === 'completed') summary.completed += 1
      return summary
    },
    { total: 0, running: 0, ready: 0, failed: 0, completed: 0 },
  )
}

export function lastLogs(logs: AgentLog[] | undefined, limit = 3): AgentLog[] {
  if (!logs?.length) return []
  return logs.slice(Math.max(0, logs.length - limit))
}

type ProductionPhaseId = 'prepared' | 'workspace' | 'coding' | 'validated' | 'pr'

interface ProductionPhase {
  id: ProductionPhaseId
  label: string
  done: boolean
  detail: string
}

export function getProductionPhases(delegation: Delegation): ProductionPhase[] {
  const logs = delegation.logs ?? []
  const logText = logs.map(log => log.message).join('\n').toLowerCase()
  const report = delegation.summaryReport
  const changedFiles = [
    ...(report?.changes ?? []),
    ...(report?.filesAdded ?? []),
    ...(report?.filesModified ?? []),
    ...(report?.filesDeleted ?? []),
  ].filter(Boolean)

  const workspaceLog = logs.find(log => /workspace vorbereitet|runner-workspace vorbereitet|codex-workspace vorbereitet|ollama-workspace vorbereitet/i.test(log.message))
  const hasCodeEvidence = changedFiles.length > 0 || /code committed|commit|files changed|dateien geaendert|wrote /i.test(logText)
  const hasValidation = Boolean(report?.testsPassed && report.testsPassed > 0) || /validierung gruen|tests?.*pass|type-check|lint/i.test(logText)

  return [
    {
      id: 'prepared',
      label: 'Vorbereitet',
      done: ['approved', 'running', 'completed', 'failed'].includes(delegation.status),
      detail: delegation.contract.requiresApproval ? 'Freigabe erforderlich' : 'Freigegeben oder automatisch erlaubt',
    },
    {
      id: 'workspace',
      label: 'Workspace',
      done: Boolean(workspaceLog || delegation.startedAt),
      detail: workspaceLog ? workspaceLog.message.replace(/^.*Workspace vorbereitet:\s*/i, '') : 'Noch kein isolierter Arbeitsbereich',
    },
    {
      id: 'coding',
      label: 'Code',
      done: hasCodeEvidence,
      detail: changedFiles.length > 0 ? `${changedFiles.length} Datei(en) geaendert` : 'Noch keine Codeaenderung erkannt',
    },
    {
      id: 'validated',
      label: 'Validiert',
      done: hasValidation,
      detail: report?.testsPassed ? `${report.testsPassed} Test(s) bestanden` : 'Tests/Lint/Typecheck noch nicht belegt',
    },
    {
      id: 'pr',
      label: 'PR',
      done: Boolean(report?.prUrl),
      detail: report?.prUrl ?? 'Noch kein Pull Request',
    },
  ]
}

export function getRecommendedAction(delegation: Delegation): string {
  const phases = getProductionPhases(delegation)
  if (delegation.status === 'failed') return 'Fehler pruefen und Retry mit kleinerem Scope starten.'
  if (delegation.status === 'approved') return 'Starten, dann Live-Logs und Workspace beobachten.'
  if (delegation.status === 'running') return 'Laufen lassen und pruefen, ob Code/Tests/PR erscheinen.'
  if (!phases.find(phase => phase.id === 'coding')?.done) return 'Nicht mergen: Es wurde noch keine Codeaenderung erkannt.'
  if (!phases.find(phase => phase.id === 'validated')?.done) return 'Vor Merge erst Tests, Typecheck und Lint nachholen.'
  if (!phases.find(phase => phase.id === 'pr')?.done) return 'PR erstellen, damit Aenderungen reviewbar werden.'
  return 'PR pruefen und bei gruenem CI mergen.'
}

function statusTone(status: DelegationStatus): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'running') return 'warning'
  if (status === 'approved') return 'info'
  if (status === 'completed') return 'success'
  if (status === 'failed' || status === 'rejected') return 'danger'
  return 'neutral'
}

function StatusIcon({ status }: { status: DelegationStatus }) {
  if (status === 'running') return <Activity className="h-4 w-4 animate-pulse text-amber-300" />
  if (status === 'approved') return <PlayCircle className="h-4 w-4 text-violet-300" />
  if (status === 'completed') return <CheckCircle2 className="h-4 w-4 text-emerald-300" />
  if (status === 'failed' || status === 'rejected') return <XCircle className="h-4 w-4 text-rose-300" />
  return <Clock3 className="h-4 w-4 text-slate-500" />
}

function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'gerade'
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function getAgentLabel(delegation: Delegation): string {
  const model = delegation.contract.llmModel?.trim()
  if (model) return model
  if (delegation.executionRoute === 'ollama-agent') return 'Ollama'
  if (delegation.executionRoute === 'local-agent') return 'Lokaler Agent'
  if (delegation.executionRoute === 'runner') return 'Runner'
  if (delegation.executionRoute === 'manual') return 'Manuell'
  return delegation.executionRoute
}

function getNextActionLabel(status: DelegationStatus): string {
  if (status === 'approved') return 'Oeffnen und starten'
  if (status === 'running') return 'Live verfolgen'
  if (status === 'failed') return 'Fehler pruefen'
  return 'Details oeffnen'
}

function LogLine({ log }: { log: AgentLog }) {
  return (
    <div className="grid grid-cols-[3.25rem_4.5rem_minmax(0,1fr)] gap-2 rounded-md border border-white/[0.05] bg-black/15 px-2.5 py-1.5 text-xs">
      <span className="font-mono text-slate-500">{formatTime(log.timestamp)}</span>
      <span
        className={cx(
          'font-semibold uppercase tracking-wide',
          log.type === 'error' && 'text-rose-300',
          log.type === 'success' && 'text-emerald-300',
          log.type === 'command' && 'text-amber-300',
          log.type === 'thought' && 'text-violet-300',
          log.type === 'info' && 'text-slate-400',
        )}
      >
        {log.type}
      </span>
      <span className="truncate text-slate-300">{log.message}</span>
    </div>
  )
}

function DelegationActivityCard({ delegation }: { delegation: Delegation }) {
  const logs = lastLogs(delegation.logs)
  const detailHref = `/delegations/${delegation.id}`
  const phases = getProductionPhases(delegation)
  const prUrl = delegation.summaryReport?.prUrl

  return (
    <article className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusIcon status={delegation.status} />
            <Badge tone={statusTone(delegation.status)}>{statusLabel[delegation.status]}</Badge>
            <Badge tone="neutral">Risk {delegation.contract.riskClass}</Badge>
            <span className="text-xs text-slate-500">{getAgentLabel(delegation)}</span>
          </div>
          <Link href={detailHref} className="mt-2 block truncate text-base font-semibold text-white hover:text-violet-200">
            {delegation.title || delegation.contract.goal}
          </Link>
          {/* Dynamic phase — replaces generic status text for running/failed/done */}
          {(delegation.status === 'running' || delegation.status === 'failed' || delegation.status === 'completed') ? (
            <div className="mt-2">
              <AgentPhaseIndicator info={inferAgentPhase(delegation)} showProgress />
            </div>
          ) : (
            <p className="mt-1 text-sm leading-6 text-slate-400">
              Der Agent {statusText[delegation.status]}. Letzte Aktualisierung: {formatTime(delegation.updatedAt)}.
            </p>
          )}
        </div>
        <Link href={detailHref} className={buttonClassName(delegation.status === 'approved' ? 'primary' : 'secondary', 'shrink-0')}>
          {getNextActionLabel(delegation.status)}
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-5">
        {phases.map(phase => (
          <div
            key={phase.id}
            className={cx(
              'rounded-lg border px-3 py-2',
              phase.done
                ? 'border-emerald-500/20 bg-emerald-500/10'
                : 'border-white/[0.06] bg-black/10',
            )}
            title={phase.detail}
          >
            <div className="flex items-center gap-2">
              <span className={cx('h-2 w-2 rounded-full', phase.done ? 'bg-emerald-300' : 'bg-slate-600')} />
              <span className={cx('text-xs font-semibold', phase.done ? 'text-emerald-200' : 'text-slate-400')}>{phase.label}</span>
            </div>
            <p className="mt-1 truncate text-[11px] text-slate-500">{phase.detail}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-lg border border-white/[0.06] bg-black/15 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-300">
          <span className="font-semibold text-white">Naechste Aktion:</span> {getRecommendedAction(delegation)}
        </p>
        {prUrl && (
          <a href={prUrl} target="_blank" rel="noreferrer" className={buttonClassName('secondary', 'shrink-0')}>
            <GitPullRequest className="h-3.5 w-3.5" />
            PR oeffnen
          </a>
        )}
      </div>

      {logs.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Letzte Agenten-Schritte</p>
          {logs.map(log => (
            <LogLine key={`${log.timestamp}-${log.type}-${log.message}`} log={log} />
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-white/[0.07] px-3 py-2 text-xs text-slate-500">
          Noch keine Logs vorhanden. Sobald die Delegation startet, erscheinen hier Befehle, Fortschritt und Fehler.
        </p>
      )}
    </article>
  )
}

export function LiveAgentActivityPanel() {
  const [delegations, setDelegations] = useState<Delegation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const response = await fetch('/api/delegations?limit=40', { cache: 'no-store' })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = (await response.json()) as Delegation[]
        if (!cancelled) {
          setDelegations(Array.isArray(data) ? data : [])
          setError(null)
          setLastRefresh(new Date().toISOString())
        }
      } catch {
        if (!cancelled) setError('Delegationen konnten gerade nicht geladen werden.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    const interval = window.setInterval(() => void load(), REFRESH_MS)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [])

  const sorted = useMemo(() => sortLiveDelegations(delegations), [delegations])
  const visible = sorted.slice(0, MAX_VISIBLE)
  const summary = summarizeLiveActivity(delegations)

  return (
    <Panel className="mb-6 overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-white/[0.06] p-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Agenten-Aktivitaet</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">Was macht ForgePilot gerade konkret?</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Hier siehst du laufende, vorbereitete und gerade abgeschlossene Delegationen inklusive Agent, Route und letzten Logzeilen.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Badge tone={summary.running > 0 ? 'warning' : 'neutral'}>{summary.running} arbeitet</Badge>
          <Badge tone={summary.ready > 0 ? 'info' : 'neutral'}>{summary.ready} bereit</Badge>
          <Badge tone={summary.completed > 0 ? 'success' : 'neutral'}>{summary.completed} fertig</Badge>
          <Badge tone={summary.failed > 0 ? 'danger' : 'neutral'}>{summary.failed} Fehler</Badge>
        </div>
      </div>

      <div className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span>
            {loading ? 'Lade Live-Daten...' : `${summary.total} Delegationen im Blick`}
            {lastRefresh ? `, aktualisiert ${formatTime(lastRefresh)}` : ''}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Auto-Refresh alle 5 Sekunden
          </span>
        </div>

        {error ? (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>
        ) : visible.length === 0 && !loading ? (
          <EmptyState
            title="Gerade ist kein Agent aktiv"
            description="Starte eine Delegation oder bereite im Projekt die naechste Aufgabe vor. Danach erscheinen hier Status, Logs und naechste Aktionen."
            action={<Link href="/projects" className={buttonClassName('primary')}>Projekt oeffnen</Link>}
          />
        ) : (
          <div className="space-y-3">
            {visible.map(delegation => (
              <DelegationActivityCard key={delegation.id} delegation={delegation} />
            ))}
          </div>
        )}

        {sorted.length > MAX_VISIBLE && (
          <div className="mt-4 text-center">
            <Link href="/delegations" className={buttonClassName('ghost')}>
              Alle Delegationen anzeigen
            </Link>
          </div>
        )}
      </div>
    </Panel>
  )
}
