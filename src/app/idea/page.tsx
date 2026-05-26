'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { cx } from '@/components/ui/primitives'
import type { IdeaHistoryEntry } from '@/lib/pilot/idea-history-store'
import { IdeaRefinementWizard } from '@/components/idea/IdeaRefinementWizard'
import type { RefinedBriefDraft } from '@/app/api/idea/refine/route'

interface PipelineResult {
  briefId: string
  briefTitle: string
  planningMode?: PlanningMode
  targetPlatform?: TargetPlatform
  platformGuidance?: string
  persistenceStrategy?: PersistenceStrategy
  persistenceGuidance?: string
  workItemCount: number
  topItem: { title: string; estimatedMinutes: number }
  delegation: { id: string; title: string }
  run: { id: string }
  taskCount: number
}

type Stage = 'idle' | 'expanding' | 'brief' | 'items' | 'orchestrating' | 'done' | 'error'
type RunStatus = 'planning' | 'running' | 'done' | 'failed' | 'aborted'
type TaskStatus = 'pending' | 'assigned' | 'running' | 'done' | 'failed' | 'skipped'
type PlanningMode = 'beginner' | 'expert'
type TargetPlatform = 'webapp' | 'desktop' | 'mobile' | 'cross_platform' | 'undecided'
type PersistenceStrategy = 'recommend' | 'postgres' | 'sqlite' | 'json_file' | 'supabase' | 'none'

interface LiveTask {
  id: string
  title: string
  status: TaskStatus
  grade?: string
  qualityScore?: number
}

interface LiveRunState {
  status: RunStatus
  tasks: LiveTask[]
  doneTasks: number
  totalTasks: number
  overallScore?: number
}

const STAGE_LABELS: Record<Stage, string> = {
  idle: '',
  expanding: 'Idee wird verstanden…',
  brief: 'Produktbrief wird erstellt…',
  items: 'Funktionen und Arbeitspakete werden abgeleitet…',
  orchestrating: 'Nächste Ausführung wird vorbereitet…',
  done: 'Fertig',
  error: 'Fehler',
}

const EXAMPLES = [
  'Ich möchte ForgePilot einfacher machen: Idee eingeben, Plan bekommen, Ausführung starten.',
  'Eine App, die meine täglichen Projektentscheidungen priorisiert und begründet.',
  'Ein Dashboard, das mir nur den nächsten sinnvollen Schritt zeigt.',
  'Ein zuverlässiger KI-Workflow für Codeänderungen mit Critic-Review und PR.',
  'Ein lokales Assistant-System, das Wissen speichert und wiederverwendet.',
]

const TARGET_PLATFORM_OPTIONS: Array<{
  value: TargetPlatform
  label: string
  description: string
  bestFor: string
}> = [
  {
    value: 'webapp',
    label: 'Webapp',
    description: 'Schneller MVP im Browser, responsiv und gut teilbar.',
    bestFor: 'SaaS, Dashboards, interne Tools',
  },
  {
    value: 'desktop',
    label: 'Desktop App',
    description: 'Lokale Dateien, Systemintegration und starke Offline-Nutzung.',
    bestFor: 'Power-Tools, lokale KI, Datei-Workflows',
  },
  {
    value: 'mobile',
    label: 'Mobile iOS & Android',
    description: 'Touch-first, unterwegs nutzbar, Push und kleine Screens.',
    bestFor: 'Consumer, Field Work, schnelle Eingabe',
  },
  {
    value: 'cross_platform',
    label: 'Cross-platform',
    description: 'Ein Kern, mehrere Oberflächen mit klarer Reihenfolge.',
    bestFor: 'Produkte mit Web, Desktop und Mobile',
  },
  {
    value: 'undecided',
    label: 'ForgePilot empfiehlt',
    description: 'ForgePilot soll entscheiden, welche Form sinnvoll ist.',
    bestFor: 'Frühe Ideen und Strategiefragen',
  },
]

const TARGET_PLATFORM_LABELS: Record<TargetPlatform, string> = {
  webapp: 'Webapp',
  desktop: 'Desktop App',
  mobile: 'Mobile iOS & Android',
  cross_platform: 'Cross-platform',
  undecided: 'ForgePilot empfiehlt',
}

const PERSISTENCE_OPTIONS: Array<{
  value: PersistenceStrategy
  label: string
  description: string
  bestFor: string
}> = [
  {
    value: 'recommend',
    label: 'ForgePilot empfiehlt',
    description: 'Standard: passend zu Produktform, Risiko und Nutzungsart.',
    bestFor: 'Wenn du noch nicht sicher bist',
  },
  {
    value: 'postgres',
    label: 'PostgreSQL',
    description: 'Robuste Produktiv-Datenbank mit Transaktionen und Queries.',
    bestFor: 'SaaS, Teams, Agenten parallel',
  },
  {
    value: 'sqlite',
    label: 'SQLite',
    description: 'Lokale Datenbank ohne Server, gut fuer Offline/Desktop.',
    bestFor: 'Single-User, Desktop, lokal',
  },
  {
    value: 'json_file',
    label: 'JSON-Dateien',
    description: 'Einfach, portabel, aber nur fuer Prototypen oder Export.',
    bestFor: 'POC, lokale Konfig, Backup',
  },
  {
    value: 'supabase',
    label: 'Supabase',
    description: 'Managed Postgres plus Auth, Realtime und Storage.',
    bestFor: 'Schneller SaaS/Webapp Start',
  },
  {
    value: 'none',
    label: 'Keine DB',
    description: 'Nur temporaere Daten oder reiner Rechner/Generator.',
    bestFor: 'Demos, statische Tools',
  },
]

const PERSISTENCE_LABELS: Record<PersistenceStrategy, string> = {
  recommend: 'ForgePilot empfiehlt',
  postgres: 'PostgreSQL',
  sqlite: 'SQLite',
  json_file: 'JSON-Dateien',
  supabase: 'Supabase',
  none: 'Keine DB',
}

const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Warte',
  assigned: 'Zugewiesen',
  running: 'Läuft',
  done: 'Fertig',
  failed: 'Fehler',
  skipped: 'Übersprungen',
}

function taskStatusColor(s: TaskStatus): string {
  if (s === 'done') return 'text-emerald-400'
  if (s === 'running') return 'text-violet-400'
  if (s === 'failed') return 'text-rose-400'
  if (s === 'assigned') return 'text-sky-400'
  return 'text-slate-600'
}

function taskStatusIcon(s: TaskStatus): string {
  if (s === 'done') return '✓'
  if (s === 'running') return '⚙'
  if (s === 'failed') return '✗'
  if (s === 'assigned') return '→'
  return '○'
}

export default function IdeaPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [idea, setIdea] = useState('')
  const [planningMode, setPlanningMode] = useState<PlanningMode>('beginner')
  const [targetPlatform, setTargetPlatform] = useState<TargetPlatform>('undecided')
  const [customPlatformNote, setCustomPlatformNote] = useState('')
  const [persistenceStrategy, setPersistenceStrategy] = useState<PersistenceStrategy>('recommend')
  const [stage, setStage] = useState<Stage>('idle')
  const [result, setResult] = useState<PipelineResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [liveRun, setLiveRun] = useState<LiveRunState | null>(null)
  const [history, setHistory] = useState<IdeaHistoryEntry[]>([])
  const [aborting, setAborting] = useState(false)
  const [startingRun, setStartingRun] = useState(false)
  const [showWizard, setShowWizard] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const historyPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const queryPrompt = searchParams.get('prompt')?.trim() ?? ''
  const hasAssistantPrompt = Boolean(queryPrompt)

  /** M136: Create project brief from refined wizard output and navigate to it */
  const handleWizardBriefReady = useCallback(async (rawIdea: string, brief: RefinedBriefDraft) => {
    setShowWizard(false)
    try {
      const res = await fetch('/api/project-briefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: brief.title,
          rawIdea,
          problemStatement: brief.problemStatement,
          targetAudience: brief.targetAudience,
          desiredOutcome: brief.desiredOutcome,
          scope: brief.scope,
        }),
      })
      const created = await res.json() as { id: string }
      if (created.id) {
        router.push(`/project-briefs/${created.id}`)
      }
    } catch {
      setError('Fehler beim Erstellen des Produktbriefs.')
    }
  }, [router])

  const refreshHistory = useCallback(() => {
    fetch('/api/pilot/idea-history?limit=5')
      .then(r => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) setHistory(data as IdeaHistoryEntry[])
      })
      .catch(() => { /* non-critical */ })
  }, [])

  // Load on mount, then poll every 5s while any entry is active
  useEffect(() => {
    refreshHistory()
  }, [refreshHistory])

  useEffect(() => {
    if (!queryPrompt) return
    setIdea(current => current.trim() ? current : queryPrompt)
  }, [queryPrompt])

  // Adaptive history polling: faster when entries are in-flight
  useEffect(() => {
    if (historyPollRef.current) clearInterval(historyPollRef.current)
    const hasActive = history.some(e => e.status === 'building' || e.status === 'running')
    if (!hasActive) return
    historyPollRef.current = setInterval(refreshHistory, 5000)
    return () => {
      if (historyPollRef.current) clearInterval(historyPollRef.current)
    }
  }, [history, refreshHistory])

  const isRunning = stage !== 'idle' && stage !== 'done' && stage !== 'error'

  // ─── Live run polling ──────────────────────────────────────────────────────

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const pollRun = useCallback(async (runId: string) => {
    try {
      const res = await fetch(`/api/agents/orchestrate/${runId}`)
      if (!res.ok) return
      const run = await res.json() as {
        status: RunStatus
        tasks: Array<{
          task: { id: string; title: string }
          status: TaskStatus
          result?: { grade: string; qualityScore: number }
        }>
        overallQualityScore?: number
      }

      const tasks: LiveTask[] = run.tasks.map(entry => ({
        id: entry.task.id,
        title: entry.task.title,
        status: entry.status,
        grade: entry.result?.grade,
        qualityScore: entry.result?.qualityScore,
      }))

      setLiveRun({
        status: run.status,
        tasks,
        doneTasks: tasks.filter(t => t.status === 'done').length,
        totalTasks: tasks.length,
        overallScore: run.overallQualityScore,
      })

      // Stop polling when run reaches terminal state
      if (run.status === 'done' || run.status === 'failed' || run.status === 'aborted') {
        stopPolling()
      }
    } catch {
      // Continue polling on transient errors
    }
  }, [stopPolling])

  const startPolling = useCallback((runId: string) => {
    stopPolling()
    void pollRun(runId)
    pollRef.current = setInterval(() => void pollRun(runId), 3000)
  }, [pollRun, stopPolling])

  // Cleanup on unmount
  useEffect(() => () => stopPolling(), [stopPolling])

  const handleAbort = useCallback(async () => {
    if (!result?.run.id) return
    setAborting(true)
    await fetch(`/api/agents/orchestrate/${result.run.id}/abort`, { method: 'POST' }).catch(() => {})
    setLiveRun(r => r ? { ...r, status: 'aborted' } : r)
    stopPolling()
    setAborting(false)
  }, [result, stopPolling])

  const handleStartExecution = useCallback(async () => {
    if (!result?.run.id || startingRun) return
    setStartingRun(true)
    setError(null)
    try {
      await fetch(`/api/agents/orchestrate/${result.run.id}/execute`, { method: 'POST' })
      startPolling(result.run.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ausführung konnte nicht gestartet werden.')
    } finally {
      setStartingRun(false)
    }
  }, [result, startPolling, startingRun])

  // ─── Pipeline execution ────────────────────────────────────────────────────

  const handleBuild = async () => {
    if (!idea.trim() || isRunning) return

    setStage('expanding')
    setResult(null)
    setError(null)
    setLiveRun(null)
    stopPolling()

    const stageTimer1 = setTimeout(() => setStage('brief'), 1800)
    const stageTimer2 = setTimeout(() => setStage('items'), 3800)
    const stageTimer3 = setTimeout(() => setStage('orchestrating'), 5500)

    try {
      const res = await fetch('/api/pilot/idea-to-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea: idea.trim(),
          planningMode,
          targetPlatform: effectiveTargetPlatform,
          customPlatformNote: effectiveCustomPlatformNote || undefined,
          persistenceStrategy: effectivePersistenceStrategy,
        }),
      })

      clearTimeout(stageTimer1)
      clearTimeout(stageTimer2)
      clearTimeout(stageTimer3)

      if (!res.ok) {
        const err = await res.json() as { error?: string }
        throw new Error(err.error ?? `Fehler ${res.status}`)
      }

      const data = await res.json() as PipelineResult
      setResult(data)
      setStage('done')

      // Refresh history to show the new entry
      refreshHistory()

    } catch (err) {
      clearTimeout(stageTimer1)
      clearTimeout(stageTimer2)
      clearTimeout(stageTimer3)
      setStage('error')
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    }
  }

  const handleReset = () => {
    stopPolling()
    setIdea('')
    setStage('idle')
    setResult(null)
    setError(null)
    setLiveRun(null)
    setStartingRun(false)
    setTimeout(() => textareaRef.current?.focus(), 100)
  }

  const handleExample = (ex: string) => {
    setIdea(ex)
    textareaRef.current?.focus()
  }

  // ─── Derived state for live run ────────────────────────────────────────────

  const runIsLive = liveRun !== null && (liveRun.status === 'running' || liveRun.status === 'planning')
  const runIsDone = liveRun?.status === 'done'
  const runIsFailed = liveRun?.status === 'failed' || liveRun?.status === 'aborted'
  const effectiveTargetPlatform: TargetPlatform = planningMode === 'beginner' ? 'undecided' : targetPlatform
  const effectivePersistenceStrategy: PersistenceStrategy = planningMode === 'beginner' ? 'recommend' : persistenceStrategy
  const effectiveCustomPlatformNote = planningMode === 'beginner' ? '' : customPlatformNote.trim()

  return (
    <>
    <main className="min-h-screen bg-[#08080d] flex flex-col">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-6 py-4 flex items-center gap-3">
        <Link href="/" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">← Command Center</Link>
        <span className="text-slate-700">/</span>
        <span className="text-sm text-slate-400">Plan Mode</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-start px-6 py-12 max-w-3xl mx-auto w-full">

        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/[0.08] px-4 py-1.5 mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
            <span className="text-xs font-semibold text-violet-300 tracking-wide">Plan Mode</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white mb-3">
            Aus deiner Idee wird<br />
            <span className="text-violet-400">ein klarer Produktplan.</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto leading-relaxed">
            Beschreibe, was du erreichen willst. ForgePilot klärt Nutzen,
            Zielgruppe, MVP, Risiken und die nächsten sinnvollen Arbeitspakete.
          </p>
        </div>

        {/* Input Box */}
        {stage === 'idle' || stage === 'error' ? (
          <div className="w-full space-y-4">
            {hasAssistantPrompt && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] px-5 py-4 shadow-lg shadow-emerald-950/20">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-sm text-emerald-300">
                    ✓
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-emerald-200">
                      Daily Report hat den nächsten Schritt vorbereitet
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-emerald-100/70">
                      Der Vorschlag ist bereits eingefügt. Prüfe ihn kurz, passe Details an und erstelle daraus einen fokussierten Plan.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className={cx(
              'relative w-full rounded-2xl border transition-all duration-200',
              idea.trim()
                ? 'border-violet-500/40 bg-violet-500/[0.04] shadow-lg shadow-violet-500/10'
                : 'border-white/[0.08] bg-white/[0.02]',
            )}>
              <div className="border-b border-white/[0.05] px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Planungsmodus</p>
                    <p className="mt-1 text-xs text-slate-600">
                      {planningMode === 'beginner'
                        ? 'ForgePilot trifft Architekturentscheidungen automatisch und erklärt sie später.'
                        : 'Du kannst Produktform und Datenhaltung bewusst vorgeben.'}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 rounded-xl border border-white/[0.08] bg-slate-950 p-1">
                    {([
                      { value: 'beginner', label: 'Anfänger' },
                      { value: 'expert', label: 'Experte' },
                    ] as const).map(option => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setPlanningMode(option.value)}
                        className={cx(
                          'rounded-lg px-4 py-2 text-xs font-semibold transition',
                          planningMode === option.value
                            ? 'bg-violet-600 text-white shadow-lg shadow-violet-950/30'
                            : 'text-slate-500 hover:text-slate-300',
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <textarea
                ref={textareaRef}
                value={idea}
                onChange={e => setIdea(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    void handleBuild()
                  }
                }}
                placeholder="Beschreibe deine Idee, dein Problem oder dein Ziel… (⌘+Enter)"
                autoFocus
                rows={4}
                className="w-full resize-none bg-transparent px-5 py-4 text-base text-white placeholder-slate-600 outline-none"
              />
              {planningMode === 'beginner' ? (
                <div className="border-t border-white/[0.05] px-4 py-4">
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] p-4">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-sm text-emerald-200">
                        ✓
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-emerald-100">Automatische Empfehlung aktiv</p>
                        <p className="mt-1 text-xs leading-5 text-emerald-100/70">
                          ForgePilot empfiehlt selbst, ob Webapp, Desktop, Mobile oder Cross-platform sinnvoll ist und welche Datenhaltung passt.
                          Die Begründung erscheint danach im Projekt-Workspace und kann dort neu bewertet werden.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
              <div className="border-t border-white/[0.05] px-4 py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Produktform</p>
                    <p className="mt-1 text-xs text-slate-600">Wähle, worauf der Plan optimiert werden soll.</p>
                  </div>
                  <span className="text-xs font-medium text-violet-300">{TARGET_PLATFORM_LABELS[targetPlatform]}</span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  {TARGET_PLATFORM_OPTIONS.map(option => {
                    const selected = targetPlatform === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setTargetPlatform(option.value)}
                        className={cx(
                          'rounded-xl border p-3 text-left transition-all',
                          selected
                            ? 'border-violet-500/45 bg-violet-500/[0.12] shadow-lg shadow-violet-950/20'
                            : 'border-white/[0.06] bg-white/[0.025] hover:border-white/[0.12] hover:bg-white/[0.04]',
                        )}
                      >
                        <span className={cx('block text-xs font-semibold', selected ? 'text-violet-100' : 'text-slate-300')}>{option.label}</span>
                        <span className="mt-1 block text-[11px] leading-4 text-slate-500">{option.description}</span>
                        <span className="mt-2 block text-[10px] leading-4 text-slate-600">{option.bestFor}</span>
                      </button>
                    )
                  })}
                </div>
                <label className="mt-3 block rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                  <span className="text-xs font-semibold text-slate-400">Eigene Vorgabe optional</span>
                  <input
                    value={customPlatformNote}
                    onChange={event => setCustomPlatformNote(event.target.value)}
                    placeholder="z.B. erst Webapp, später Desktop Wrapper; oder native iOS zuerst..."
                    className="mt-2 w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
                  />
                </label>
              </div>
              <div className="border-t border-white/[0.05] px-4 py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Datenhaltung</p>
                    <p className="mt-1 text-xs text-slate-600">ForgePilot kann empfehlen oder du setzt die Architektur bewusst.</p>
                  </div>
                  <span className="text-xs font-medium text-sky-300">{PERSISTENCE_LABELS[persistenceStrategy]}</span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {PERSISTENCE_OPTIONS.map(option => {
                    const selected = persistenceStrategy === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setPersistenceStrategy(option.value)}
                        className={cx(
                          'rounded-xl border p-3 text-left transition-all',
                          selected
                            ? 'border-sky-500/45 bg-sky-500/[0.10] shadow-lg shadow-sky-950/20'
                            : 'border-white/[0.06] bg-white/[0.025] hover:border-white/[0.12] hover:bg-white/[0.04]',
                        )}
                      >
                        <span className={cx('block text-xs font-semibold', selected ? 'text-sky-100' : 'text-slate-300')}>{option.label}</span>
                        <span className="mt-1 block text-[11px] leading-4 text-slate-500">{option.description}</span>
                        <span className="mt-2 block text-[10px] leading-4 text-slate-600">{option.bestFor}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
                </>
              )}
              <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.05]">
                <span className="text-xs text-slate-600">{idea.length} Zeichen</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowWizard(true)}
                    title="Idee schrittweise verfeinern (KI-Fragen → besserer Plan)"
                    className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-violet-400 hover:text-violet-300 border border-violet-800/50 hover:border-violet-700 bg-violet-950/20 hover:bg-violet-950/40 transition-all"
                  >
                    <span>✨</span> Geführte Fragen
                  </button>
                  <button
                    onClick={() => void handleBuild()}
                    disabled={!idea.trim()}
                    className={cx(
                      'flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all duration-200',
                      idea.trim()
                        ? 'bg-violet-600 text-white hover:bg-violet-500 shadow-lg shadow-violet-500/25 active:scale-95'
                        : 'bg-white/[0.04] text-slate-600 cursor-not-allowed',
                    )}
                  >
                    <span>🚀</span>
                    {hasAssistantPrompt ? 'Plan aus Vorschlag erstellen' : 'Plan erstellen'}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-800/40 bg-red-950/20 px-4 py-3 text-sm text-red-400">
                ⚠ {error}
              </div>
            )}

            {/* Examples */}
            <div>
              <p className="text-xs text-slate-600 mb-2 px-1">Beispiele für den Plan Mode:</p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map(ex => (
                  <button
                    key={ex}
                    onClick={() => handleExample(ex)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs px-3 py-1 rounded-full cursor-pointer border border-slate-700 transition-colors"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            {/* Recent Submissions */}
            {history.length > 0 && (
              <div>
                <p className="text-xs text-slate-600 mb-2 px-1">Zuletzt eingereicht:</p>
                <div className="space-y-2">
                  {history.map(entry => {
                    const statusCx =
                      entry.status === 'done'    ? 'text-emerald-400'
                      : entry.status === 'failed'  ? 'text-rose-400'
                      : entry.status === 'running' ? 'text-violet-400'
                      : 'text-slate-600'
                    const statusLabel =
                      entry.status === 'done'    ? '✓ Fertig'
                      : entry.status === 'failed'  ? '✗ Fehler'
                      : entry.status === 'running' ? '⚙ Läuft'
                      : '… Wird geplant'
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-300 truncate">{entry.briefTitle}</p>
                          <p className="text-xs text-slate-600 truncate">{entry.idea.slice(0, 55)}{entry.idea.length > 55 ? '…' : ''}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={cx('text-xs font-medium', statusCx)}>
                            {entry.status === 'running' && <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />}
                            {statusLabel}
                          </span>
                          <Link href="/orchestrations" className="text-xs text-slate-600 hover:text-violet-400 transition-colors">
                            →
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Pipeline Progress */}
        {isRunning && (
          <div className="w-full space-y-6">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
              <div className="mb-5">
                <p className="text-xs text-slate-500 mb-1">Deine Idee</p>
                <p className="text-sm text-slate-300 line-clamp-2">{idea}</p>
              </div>

              <div className="space-y-3">
                {(
                  [
                    { key: 'expanding', label: 'Idee verstehen und strukturieren', icon: '🧠' },
                    { key: 'brief',     label: 'Produktbrief erstellen',           icon: '📋' },
                    { key: 'items',     label: 'Funktionen und Arbeitspakete ableiten', icon: '✅' },
                    { key: 'orchestrating', label: 'Nächste Ausführung vorbereiten', icon: '⚙' },
                  ] as const
                ).map((s, i) => {
                  const stageOrder = ['expanding', 'brief', 'items', 'orchestrating']
                  const currentIdx = stageOrder.indexOf(stage)
                  const stepIdx = i
                  const isDone = stepIdx < currentIdx
                  const isActive = stepIdx === currentIdx
                  return (
                    <div key={s.key} className={cx(
                      'flex items-center gap-3 rounded-lg px-4 py-3 transition-all',
                      isActive ? 'border border-violet-500/30 bg-violet-500/[0.06]' : 'border border-transparent',
                    )}>
                      <span className={cx('text-lg transition-all', isDone ? 'opacity-100' : isActive ? 'opacity-100' : 'opacity-25')}>
                        {isDone ? '✓' : s.icon}
                      </span>
                      <span className={cx(
                        'text-sm font-medium transition-colors',
                        isDone ? 'text-emerald-400' : isActive ? 'text-white' : 'text-slate-600',
                      )}>
                        {s.label}
                      </span>
                      {isActive && (
                        <span className="ml-auto flex gap-1">
                          {[0, 1, 2].map(d => (
                            <span key={d} className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${d * 150}ms` }} />
                          ))}
                        </span>
                      )}
                      {isDone && (
                        <span className="ml-auto text-xs text-emerald-400/60">Erledigt</span>
                      )}
                    </div>
                  )
                })}
              </div>

              <p className="mt-4 text-center text-xs text-slate-600">{STAGE_LABELS[stage]}</p>
            </div>
          </div>
        )}

        {/* Result */}
        {stage === 'done' && result && (
          <div className="w-full space-y-4">
            {/* Success card */}
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-6">
              <div className="flex items-start gap-4">
                <span className="text-3xl shrink-0">✅</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-emerald-400/70 font-semibold uppercase tracking-wide mb-1">Plan erstellt</p>
                  <h2 className="text-xl font-bold text-white leading-tight">{result.briefTitle}</h2>
                  <div className="flex flex-wrap gap-4 mt-3">
                    <span className="flex items-center gap-1.5 text-sm text-slate-400">
                      <span>🧭</span>
                      <span>{(result.planningMode ?? planningMode) === 'beginner' ? 'Automatik' : 'Experte'}</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-sm text-slate-400">
                      <span>📱</span>
                      <span>{TARGET_PLATFORM_LABELS[result.targetPlatform ?? targetPlatform]}</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-sm text-slate-400">
                      <span>🗄️</span>
                      <span>{PERSISTENCE_LABELS[result.persistenceStrategy ?? persistenceStrategy]}</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-sm text-slate-400">
                      <span>📋</span>
                      <span>{result.workItemCount} Arbeitspakete</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-sm text-slate-400">
                      <span>🎯</span>
                      <span className="truncate max-w-[200px]">{result.topItem.title}</span>
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href={`/projects/${result.briefId}`}
                  className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium bg-violet-600 text-white hover:bg-violet-500 transition-colors"
                >
                  <span>🧭</span> Projekt Workspace öffnen
                </Link>
                <Link
                  href={`/project-briefs/${result.briefId}`}
                  className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium border border-white/[0.08] bg-white/[0.02] text-slate-300 hover:border-violet-500/30 hover:text-white transition-colors"
                >
                  <span>📋</span> Produktbrief ansehen
                </Link>
                {liveRun ? (
                  <Link
                    href={`/orchestrations`}
                    className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium border border-white/[0.08] bg-white/[0.02] text-slate-300 hover:border-violet-500/30 hover:text-white transition-colors"
                  >
                    <span>🔗</span> Ausführung ansehen
                  </Link>
                ) : (
                  <button
                    onClick={() => void handleStartExecution()}
                    disabled={startingRun}
                    className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium border border-violet-500/30 bg-violet-500/10 text-violet-200 hover:bg-violet-500/15 disabled:opacity-50 transition-colors"
                  >
                    <span>▶</span> {startingRun ? 'Ausführung startet…' : 'Ausführung starten'}
                  </button>
                )}
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium border border-white/[0.06] bg-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600 transition-colors"
                >
                  + Neue Idee planen
                </button>
              </div>
            </div>

            {/* Pipeline summary */}
            <div className="grid gap-3 sm:grid-cols-3">
              <Link
                href={`/project-briefs/${result.briefId}`}
                className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-violet-500/30 transition-colors"
              >
                <p className="text-2xl mb-2">📋</p>
                <p className="text-xs text-slate-500 mb-0.5">Produktbrief</p>
                <p className="text-sm font-medium text-white group-hover:text-violet-300 transition-colors line-clamp-2">{result.briefTitle}</p>
                <p className="mt-2 text-xs text-violet-400 group-hover:underline">Brief öffnen →</p>
              </Link>

              <Link
                href={`/projects/${result.briefId}`}
                className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-sky-500/30 transition-colors"
              >
                <p className="text-2xl mb-2">🧭</p>
                <p className="text-xs text-slate-500 mb-0.5">Projekt Workspace</p>
                <p className="text-sm font-medium text-white">{result.workItemCount} Arbeitspakete</p>
                <p className="mt-1 text-xs text-slate-500 line-clamp-2">Feature-Delegations, KI Projektmanager und Fortschritt an einem Ort.</p>
                <p className="mt-2 text-xs text-sky-400 group-hover:underline">Workspace öffnen →</p>
              </Link>

              <Link
                href={`/orchestrations`}
                className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-emerald-500/30 transition-colors"
              >
                <p className="text-2xl mb-2">⚙</p>
                <p className="text-xs text-slate-500 mb-0.5">Ausführung</p>
                <p className="text-sm font-medium text-white">{result.taskCount} Sub-Tasks</p>
                {runIsDone
                  ? <p className="mt-1 text-xs text-emerald-400">✓ Ausführung abgeschlossen</p>
                  : runIsFailed
                  ? <p className="mt-1 text-xs text-rose-400">✗ Ausführung fehlgeschlagen</p>
                  : liveRun
                  ? <p className="mt-1 text-xs text-violet-400 animate-pulse">Wird ausgeführt…</p>
                  : <p className="mt-1 text-xs text-slate-500">Bereit zum Starten</p>
                }
                <p className="mt-2 text-xs text-emerald-400 group-hover:underline">Ausführung ansehen →</p>
              </Link>
            </div>

            <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.07] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-violet-300">KI Projektmanager</p>
                  <p className="mt-1 text-sm leading-6 text-slate-300">
                    Der Plan ist jetzt als {TARGET_PLATFORM_LABELS[result.targetPlatform ?? targetPlatform]}-Projekt angelegt. Im Workspace siehst du, welche Feature-Delegation als nächstes sinnvoll ist,
                    welche Agenten aktiv sind und was sicher automatisch gestartet werden kann.
                  </p>
                  {(result.planningMode ?? planningMode) === 'beginner' && (
                    <p className="mt-2 text-xs leading-5 text-emerald-100/75">
                      Anfänger-Modus: ForgePilot hat Produktform und Datenhaltung automatisch festgelegt. Du kannst die Empfehlung im Projekt später neu bewerten.
                    </p>
                  )}
                  {result.platformGuidance && (
                    <p className="mt-2 text-xs leading-5 text-violet-100/70">{result.platformGuidance}</p>
                  )}
                  {result.persistenceGuidance && (
                    <p className="mt-2 text-xs leading-5 text-sky-100/75">{result.persistenceGuidance}</p>
                  )}
                </div>
                <Link
                  href={`/projects/${result.briefId}`}
                  className="shrink-0 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                >
                  PM-Empfehlungen ansehen
                </Link>
              </div>
            </div>

            {/* Live Run Status Widget */}
            {liveRun && liveRun.tasks.length > 0 && (
              <div className={cx(
                'rounded-xl border p-4 transition-all',
                runIsDone
                  ? 'border-emerald-500/20 bg-emerald-950/10'
                  : runIsFailed
                  ? 'border-rose-500/20 bg-rose-950/10'
                  : 'border-violet-500/20 bg-violet-950/10',
              )}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {runIsLive && (
                      <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
                    )}
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      {runIsDone ? 'Ausführung abgeschlossen' : runIsFailed ? 'Ausführung fehlgeschlagen' : 'Ausführung aktiv'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {liveRun.overallScore !== undefined && runIsDone && (
                      <span className="text-xs font-bold text-emerald-400">
                        Ø {liveRun.overallScore} Punkte
                      </span>
                    )}
                    <span className="text-xs text-slate-500">
                      {liveRun.doneTasks}/{liveRun.totalTasks} fertig
                    </span>
                    <Link
                      href="/orchestrations"
                      className="text-xs text-violet-400 hover:underline"
                    >
                      Details →
                    </Link>
                    {runIsLive && (
                      <button
                        onClick={handleAbort}
                        disabled={aborting}
                        className="text-xs text-rose-400 hover:text-rose-300 disabled:opacity-40 transition-colors"
                      >
                        {aborting ? 'Abbrechend…' : '■ Abbrechen'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1 bg-white/[0.05] rounded-full mb-3 overflow-hidden">
                  <div
                    className={cx(
                      'h-full rounded-full transition-all duration-500',
                      runIsDone ? 'bg-emerald-500' : runIsFailed ? 'bg-rose-500' : 'bg-violet-500',
                    )}
                    style={{
                      width: liveRun.totalTasks > 0
                        ? `${(liveRun.doneTasks / liveRun.totalTasks) * 100}%`
                        : '0%',
                    }}
                  />
                </div>

                {/* Task list */}
                <div className="space-y-1.5">
                  {liveRun.tasks.map(task => (
                    <div key={task.id} className="flex items-center gap-2.5">
                      <span className={cx('text-xs font-mono w-3 text-center', taskStatusColor(task.status))}>
                        {taskStatusIcon(task.status)}
                      </span>
                      <span className={cx(
                        'text-xs flex-1 truncate',
                        task.status === 'done' ? 'text-slate-400' : task.status === 'running' ? 'text-white' : 'text-slate-600',
                      )}>
                        {task.title}
                      </span>
                      <span className={cx('text-xs shrink-0', taskStatusColor(task.status))}>
                        {task.grade
                          ? <span className="font-bold">{task.grade}</span>
                          : TASK_STATUS_LABELS[task.status]
                        }
                      </span>
                      {task.status === 'running' && (
                        <span className="flex gap-0.5 shrink-0">
                          {[0, 1, 2].map(d => (
                            <span key={d} className="h-1 w-1 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${d * 120}ms` }} />
                          ))}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Next delegation */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-xs text-slate-500 mb-1">Empfohlener nächster Schritt</p>
              <p className="text-sm font-semibold text-white">{result.topItem.title}</p>
              <p className="text-xs text-slate-500 mt-1">~{result.topItem.estimatedMinutes} Minuten geschätzt</p>
            </div>

          </div>
        )}
      </div>
    </main>

    {/* M136: Idea Refinement Wizard */}
    {showWizard && (
      <IdeaRefinementWizard
        initialIdea={idea}
        onClose={() => setShowWizard(false)}
        onBriefReady={(rawIdea, brief) => void handleWizardBriefReady(rawIdea, brief)}
      />
    )}
  </>
  )
}
