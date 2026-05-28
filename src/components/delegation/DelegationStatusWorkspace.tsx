'use client'

import type { Delegation, DelegationStatus } from '@/lib/models/delegation'
import type { PreflightResult } from '@/lib/preflight'

export type DetailView = 'action' | 'result' | 'details'
type PhaseStep = 'created' | 'approved' | 'running' | 'completed'

export function defaultDetailView(status: DelegationStatus): DetailView {
  if (status === 'completed') return 'result'
  return 'action'
}

const ROUTE_LABELS: Record<string, string> = {
  'local-agent':  'Lokaler Agent',
  'runner':       'Agent Runner',
  'ollama-agent': 'Ollama (lokal)',
  'direct-chat':  'Direkt-Chat',
  'n8n':          'n8n Workflow',
  'manual':       'Manuell',
}

export const DETAIL_VIEWS: Array<{
  id: DetailView
  label: string
  description: string
}> = [
  {
    id: 'action',
    label: 'Verlauf',
    description: 'Live-Status, Timeline, Fehler und Agenten-Aktivität.',
  },
  {
    id: 'result',
    label: 'Ergebnis',
    description: 'PR, Aenderungen, Qualitaet, Wissen und Uebernahme.',
  },
  {
    id: 'details',
    label: 'Technik',
    description: 'Technik, Logs, Vertrag, Tools und Kommentare.',
  },
]

function phaseStepIndex(status: DelegationStatus): number {
  if (status === 'completed') return 3
  if (status === 'running') return 2
  if (status === 'approved') return 1
  return 0
}

function getStatusFirstCopy(delegation: Delegation): {
  eyebrow: string
  title: string
  body: string
  tone: 'neutral' | 'blue' | 'violet' | 'emerald' | 'red' | 'amber'
  defaultView: DetailView
} {
  switch (delegation.status) {
    case 'pending':
      return {
        eyebrow: 'Bereit zur Entscheidung',
        title: delegation.contract.requiresApproval ? 'Freigabe prüfen' : 'Delegation wartet auf Startfreigabe',
        body: 'Prüfe Ziel, Scope und Definition of Done. Danach kann der Agent kontrolliert loslegen.',
        tone: 'amber',
        defaultView: 'action',
      }
    case 'approved':
      return {
        eyebrow: 'Startbereit',
        title: 'Agent kann jetzt ausführen',
        body: 'Preflight und Policy sind die nächsten Sicherheitsnetze. Starte erst, wenn Route, Budget und Scope passen.',
        tone: 'blue',
        defaultView: 'action',
      }
    case 'running':
      return {
        eyebrow: 'Agent arbeitet',
        title: 'Ausführung läuft',
        body: 'Beobachte Live-Logs, Kosten und aktuelle Agenten-Aktion. Stoppe nur, wenn der Scope sichtbar abdriftet.',
        tone: 'violet',
        defaultView: 'action',
      }
    case 'completed':
      return {
        eyebrow: 'Bereit zur Übernahme',
        title: delegation.summaryReport?.prUrl ? 'Ergebnis prüfen und PR übernehmen' : 'Ergebnis prüfen und PR erstellen',
        body: 'Prüfe Änderungen, Critic-Bewertung und Knowledge Writeback. Danach kann der PR erstellt oder gemergt werden.',
        tone: 'emerald',
        defaultView: 'result',
      }
    case 'failed':
      return {
        eyebrow: 'Eingriff nötig',
        title: 'Fehler verstehen und kontrolliert retryen',
        body: 'Die App soll erklären, was passiert ist, und einen sicheren Retry oder eine Eskalation anbieten.',
        tone: 'red',
        defaultView: 'action',
      }
    case 'cancelled':
      return {
        eyebrow: 'Angehalten',
        title: 'Run wurde abgebrochen',
        body: 'Du kannst die Delegation prüfen, klonen oder mit klarerem Scope erneut starten.',
        tone: 'neutral',
        defaultView: 'action',
      }
    case 'rejected':
      return {
        eyebrow: 'Abgelehnt',
        title: 'Delegation bleibt gestoppt',
        body: 'Passe Scope, Risiko oder Budget an und erstelle bei Bedarf eine neue, kleinere Delegation.',
        tone: 'red',
        defaultView: 'details',
      }
    default:
      return {
        eyebrow: 'Status',
        title: 'Delegation prüfen',
        body: 'Prüfe den aktuellen Stand und entscheide den nächsten kontrollierten Schritt.',
        tone: 'neutral',
        defaultView: 'action',
      }
  }
}

const PHASE_STEPS: Array<{ id: PhaseStep; label: string }> = [
  { id: 'created', label: 'Erstellt' },
  { id: 'approved', label: 'Freigegeben' },
  { id: 'running', label: 'Läuft' },
  { id: 'completed', label: 'Fertig' },
]

const PHASE_TONES = {
  neutral: 'border-gray-800 bg-gray-900/70',
  blue: 'border-blue-800/50 bg-blue-950/20',
  violet: 'border-violet-800/50 bg-violet-950/20',
  emerald: 'border-emerald-800/50 bg-emerald-950/20',
  red: 'border-red-800/50 bg-red-950/20',
  amber: 'border-amber-800/50 bg-amber-950/20',
}

function getChangedFileCount(delegation: Delegation): number {
  const report = delegation.summaryReport
  const structuredFiles =
    (report?.filesAdded?.length ?? 0) +
    (report?.filesModified?.length ?? 0) +
    (report?.filesDeleted?.length ?? 0)
  if (structuredFiles > 0) return structuredFiles

  return report?.changes?.length ?? 0
}

function getCriticAverage(delegation: Delegation): number | null {
  if (!delegation.criticScore) return null
  const { correctness, efficiency, drift } = delegation.criticScore
  return Math.round((correctness + efficiency + drift) / 3)
}

interface DelegationStatusWorkspaceProps {
  delegation: Delegation
  activeView: DetailView
  preflightResult: PreflightResult | null
  canApprove: boolean
  canStart: boolean
  canStop: boolean
  canCreatePR: boolean
  canRetry: boolean
  canReject: boolean
  canCancel: boolean
  creatingPR: boolean
  onApprove: () => void
  onStart: () => void
  onStop: () => void
  onCreatePR: () => void
  onRetry: () => void
  onReject: () => void
  onCancel: () => void
  onToggleAutoOrchestrate: () => void
  onSelectView: (view: DetailView) => void
}

export function DelegationStatusWorkspace({
  delegation,
  activeView,
  preflightResult,
  canApprove,
  canStart,
  canStop,
  canCreatePR,
  canRetry,
  canReject,
  canCancel,
  creatingPR,
  onApprove,
  onStart,
  onStop,
  onCreatePR,
  onRetry,
  onReject,
  onCancel,
  onToggleAutoOrchestrate,
  onSelectView,
}: DelegationStatusWorkspaceProps) {
  const phaseCopy = getStatusFirstCopy(delegation)
  const activeStepIndex = phaseStepIndex(delegation.status)
  const lastVisibleLog = (delegation.logs ?? []).filter(l => l.type !== 'thought').slice(-1)[0]?.message
  const phaseProgress = Math.max(8, Math.min(100, ((activeStepIndex + 1) / PHASE_STEPS.length) * 100))
  const changedFileCount = getChangedFileCount(delegation)
  const criticAverage = getCriticAverage(delegation)

  return (
    <>
      <section className={`rounded-xl border p-5 ${PHASE_TONES[phaseCopy.tone]}`}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{phaseCopy.eyebrow}</p>
            <h2 className="mt-2 text-lg font-semibold text-white">{phaseCopy.title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-400">{phaseCopy.body}</p>

            <div className="mt-5">
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-950/70">
                <div
                  className={`h-full rounded-full transition-all ${
                    phaseCopy.tone === 'emerald' ? 'bg-emerald-500' :
                    phaseCopy.tone === 'red' ? 'bg-red-500' :
                    phaseCopy.tone === 'violet' ? 'bg-violet-500' :
                    phaseCopy.tone === 'blue' ? 'bg-blue-500' :
                    phaseCopy.tone === 'amber' ? 'bg-amber-500' : 'bg-gray-500'
                  }`}
                  style={{ width: `${phaseProgress}%` }}
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500 sm:grid-cols-4">
                {PHASE_STEPS.map((step, index) => (
                  <div key={step.id} className={index <= activeStepIndex ? 'text-gray-200' : 'text-gray-600'}>
                    <span className={`mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                      index < activeStepIndex || delegation.status === 'completed'
                        ? 'bg-emerald-900/60 text-emerald-300'
                        : index === activeStepIndex
                          ? 'bg-violet-900/60 text-violet-200'
                          : 'bg-gray-900 text-gray-600'
                    }`}>
                      {index < activeStepIndex || delegation.status === 'completed' ? '✓' : index + 1}
                    </span>
                    {step.label}
                  </div>
                ))}
              </div>
            </div>

            {delegation.status === 'running' && lastVisibleLog && (
              <div className="mt-5 rounded-lg border border-violet-800/40 bg-gray-950/60 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-400">Agent macht gerade</p>
                <p className="mt-1 text-sm text-gray-300">{lastVisibleLog}</p>
              </div>
            )}

            {delegation.status === 'pending' && (
              <div className="mt-5 rounded-lg border border-amber-900/40 bg-gray-950/50 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">Vor Freigabe prüfen</p>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-300">Ziel</p>
                    <p className="mt-1 line-clamp-3 text-xs leading-5 text-gray-500">{delegation.contract.goal}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-300">Scope</p>
                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      {delegation.contract.writeScope?.slice(0, 3).join(', ') || 'Noch kein Scope definiert'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-300">Done</p>
                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      {delegation.contract.definitionOfDone?.length
                        ? `${delegation.contract.definitionOfDone.length} Kriterien hinterlegt`
                        : 'Definition of Done fehlt noch'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {delegation.status === 'approved' && (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-blue-900/40 bg-gray-950/50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-400">Ausführungsroute</p>
                  <p className="mt-1 text-sm font-semibold text-gray-200">{ROUTE_LABELS[delegation.executionRoute] ?? delegation.executionRoute}</p>
                  <p className="mt-1 text-xs text-gray-500">Budget ${delegation.contract.maxBudgetUsd.toFixed(2)} · Risk {delegation.contract.riskClass}</p>
                </div>
                <div className="rounded-lg border border-blue-900/40 bg-gray-950/50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-400">Startcheck</p>
                  <p className="mt-1 text-sm text-gray-300">
                    {preflightResult
                      ? `${preflightResult.checks.filter(check => check.passed).length}/${preflightResult.checks.length} Checks bestanden`
                      : 'Preflight wird beim Start sichtbar geprüft'}
                  </p>
                </div>
              </div>
            )}

            {delegation.status === 'completed' && (
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-emerald-900/40 bg-gray-950/50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500">Änderungen</p>
                  <p className="mt-1 text-lg font-bold text-emerald-300">{changedFileCount}</p>
                  <p className="text-xs text-gray-500">Dateien erkannt</p>
                </div>
                <div className="rounded-lg border border-emerald-900/40 bg-gray-950/50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500">Critic</p>
                  <p className="mt-1 text-lg font-bold text-emerald-300">{criticAverage ?? 'Offen'}</p>
                  <p className="text-xs text-gray-500">{delegation.criticScore?.verdict ?? 'Noch nicht bewertet'}</p>
                </div>
                <div className="rounded-lg border border-emerald-900/40 bg-gray-950/50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500">Übernahme</p>
                  <p className="mt-1 text-sm font-semibold text-gray-200">{delegation.summaryReport?.prUrl ? 'PR vorhanden' : 'PR fehlt'}</p>
                  <p className="text-xs text-gray-500">{delegation.summaryReport?.prState ?? 'Nächster Schritt: PR erstellen'}</p>
                </div>
              </div>
            )}

            {delegation.status === 'failed' && delegation.errorMessage && (
              <div className="mt-5 rounded-lg border border-red-900/50 bg-red-950/20 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-red-400">Fehlerursache</p>
                <p className="mt-1 text-sm text-red-200/80">{delegation.errorMessage}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-red-200/70">
                  <span className="rounded border border-red-900/50 px-2 py-1">Retry mit gleichem Scope</span>
                  <span className="rounded border border-red-900/50 px-2 py-1">Scope kleiner schneiden</span>
                  <span className="rounded border border-red-900/50 px-2 py-1">Auf besseren Agent eskalieren</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[220px]">
            {canApprove && (
              <button onClick={onApprove}
                className="rounded-lg border border-green-800 bg-green-900/50 px-4 py-2 text-sm font-semibold text-green-200 transition-colors hover:bg-green-900">
                Freigeben
              </button>
            )}
            {canStart && (
              <button onClick={onStart}
                className="rounded-lg border border-blue-800 bg-blue-900/50 px-4 py-2 text-sm font-semibold text-blue-100 transition-colors hover:bg-blue-900">
                Ausführung starten
              </button>
            )}
            {canStop && (
              <button onClick={onStop}
                className="rounded-lg border border-red-900 bg-red-900/50 px-4 py-2 text-sm font-semibold text-red-200 transition-colors hover:bg-red-900">
                Stoppen
              </button>
            )}
            {canCreatePR && (
              <button
                onClick={onCreatePR}
                disabled={creatingPR}
                className="rounded-lg border border-emerald-800 bg-emerald-900/50 px-4 py-2 text-sm font-semibold text-emerald-100 transition-colors hover:bg-emerald-900 disabled:opacity-40"
              >
                {creatingPR ? 'PR wird erstellt…' : 'GitHub PR erstellen'}
              </button>
            )}
            {canRetry && (
              <button onClick={onRetry}
                className="rounded-lg border border-blue-900/60 bg-blue-900/30 px-4 py-2 text-sm font-semibold text-blue-300 transition-colors hover:bg-blue-900/50">
                Wiederholen
              </button>
            )}
            {canReject && (
              <button onClick={onReject}
                className="rounded-lg border border-gray-800 px-4 py-2 text-sm font-semibold text-gray-500 transition-colors hover:border-red-900/60 hover:text-red-300">
                Ablehnen
              </button>
            )}
            {canCancel && (
              <button onClick={onCancel}
                className="rounded-lg border border-gray-800 px-4 py-2 text-sm font-semibold text-gray-500 transition-colors hover:border-yellow-900/60 hover:text-yellow-300">
                Abbrechen
              </button>
            )}
            {canStart && (
              <button
                onClick={onToggleAutoOrchestrate}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                  delegation.autoOrchestrate
                    ? 'border-violet-700 bg-violet-900/50 text-violet-200'
                    : 'border-gray-800 text-gray-500 hover:border-violet-900 hover:text-violet-300'
                }`}
              >
                Auto-Orchestrierung {delegation.autoOrchestrate ? 'an' : 'aus'}
              </button>
            )}
            {activeView !== phaseCopy.defaultView && (
              <button
                type="button"
                onClick={() => onSelectView(phaseCopy.defaultView)}
                className="rounded-lg border border-gray-800 px-4 py-2 text-sm font-semibold text-gray-400 transition-colors hover:border-gray-700 hover:text-gray-200"
              >
                Zur empfohlenen Ansicht
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-800 bg-gray-900/60 p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Weitere Bereiche</p>
            <p className="mt-1 text-xs text-gray-600">Die Hauptentscheidung passiert oben. Diese Bereiche sind für Verlauf, Ergebnis und technische Prüfung.</p>
          </div>
          <span className="hidden rounded-full border border-gray-800 px-2 py-1 text-[10px] text-gray-600 sm:inline">
            Status-First
          </span>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {DETAIL_VIEWS.map(view => (
            <button
              key={view.id}
              type="button"
              onClick={() => onSelectView(view.id)}
              className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                activeView === view.id
                  ? 'border-violet-700 bg-violet-950/40 text-white'
                  : 'border-transparent bg-transparent text-gray-500 hover:border-gray-800 hover:bg-gray-950/40 hover:text-gray-300'
              }`}
            >
              <span className="block text-sm font-semibold">{view.label}</span>
              <span className="mt-1 block text-xs leading-5 opacity-75">{view.description}</span>
            </button>
          ))}
        </div>
      </section>
    </>
  )
}
