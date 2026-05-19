'use client'

import { useState, useRef } from 'react'
import { cx } from '@/components/ui/primitives'

interface PipelineResult {
  briefId: string
  briefTitle: string
  workItemCount: number
  topItem: { title: string; estimatedMinutes: number }
  delegation: { id: string; title: string }
  run: { id: string }
  taskCount: number
}

type Stage = 'idle' | 'expanding' | 'brief' | 'items' | 'orchestrating' | 'done' | 'error'

const STAGE_LABELS: Record<Stage, string> = {
  idle: '',
  expanding: 'Idee wird analysiert…',
  brief: 'Project Brief wird erstellt…',
  items: 'Work Items werden generiert…',
  orchestrating: 'Agenten werden orchestriert…',
  done: 'Fertig',
  error: 'Fehler',
}

const EXAMPLES = [
  'Ein Slack-Bot der täglich einen Fortschrittsbericht aus Linear-Tickets erstellt',
  'Ein Dashboard das alle GitHub PRs nach Alter und Reviewer sortiert anzeigt',
  'Eine CLI die lokale Markdown-Dateien auf tote Links überprüft',
  'Ein API-Endpoint der Wetterdaten von OpenMeteo abruft und cacht',
  'Eine React-Komponente für ein interaktives Gantt-Diagramm',
]

export default function IdeaPage() {
  const [idea, setIdea] = useState('')
  const [stage, setStage] = useState<Stage>('idle')
  const [result, setResult] = useState<PipelineResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [autoExecuting, setAutoExecuting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isRunning = stage !== 'idle' && stage !== 'done' && stage !== 'error'

  const handleBuild = async () => {
    if (!idea.trim() || isRunning) return

    setStage('expanding')
    setResult(null)
    setError(null)

    // Simulate pipeline stage transitions for UX feedback
    const stageTimer1 = setTimeout(() => setStage('brief'), 1800)
    const stageTimer2 = setTimeout(() => setStage('items'), 3800)
    const stageTimer3 = setTimeout(() => setStage('orchestrating'), 5500)

    try {
      const res = await fetch('/api/pilot/idea-to-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: idea.trim() }),
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

      // Auto-execute the run
      setAutoExecuting(true)
      void fetch(`/api/agents/orchestrate/${data.run.id}/execute`, { method: 'POST' })
        .finally(() => setAutoExecuting(false))

    } catch (err) {
      clearTimeout(stageTimer1)
      clearTimeout(stageTimer2)
      clearTimeout(stageTimer3)
      setStage('error')
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    }
  }

  const handleReset = () => {
    setIdea('')
    setStage('idle')
    setResult(null)
    setError(null)
    setTimeout(() => textareaRef.current?.focus(), 100)
  }

  const handleExample = (ex: string) => {
    setIdea(ex)
    textareaRef.current?.focus()
  }

  return (
    <main className="min-h-screen bg-[#08080d] flex flex-col">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-6 py-4 flex items-center gap-3">
        <a href="/" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">← Command Center</a>
        <span className="text-slate-700">/</span>
        <span className="text-sm text-slate-400">Idea → Production</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-start px-6 py-12 max-w-3xl mx-auto w-full">

        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/[0.08] px-4 py-1.5 mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
            <span className="text-xs font-semibold text-violet-300 tracking-wide">Idea → Production Paradigm</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white mb-3">
            Deine Idee.<br />
            <span className="text-violet-400">Sofort gebaut.</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto leading-relaxed">
            Beschreibe was du bauen willst — ForgePilot erstellt den Brief,
            die Aufgaben, und orchestriert die KI-Agenten vollautomatisch.
          </p>
        </div>

        {/* Input Box */}
        {stage === 'idle' || stage === 'error' ? (
          <div className="w-full space-y-4">
            <div className={cx(
              'relative w-full rounded-2xl border transition-all duration-200',
              idea.trim()
                ? 'border-violet-500/40 bg-violet-500/[0.04] shadow-lg shadow-violet-500/10'
                : 'border-white/[0.08] bg-white/[0.02]',
            )}>
              <textarea
                ref={textareaRef}
                value={idea}
                onChange={e => setIdea(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    void handleBuild()
                  }
                }}
                placeholder="Beschreibe deine Idee… (⌘+Enter zum Starten)"
                autoFocus
                rows={4}
                className="w-full resize-none bg-transparent px-5 py-4 text-base text-white placeholder-slate-600 outline-none"
              />
              <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.05]">
                <span className="text-xs text-slate-600">{idea.length} Zeichen</span>
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
                  Build It
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-800/40 bg-red-950/20 px-4 py-3 text-sm text-red-400">
                ⚠ {error}
              </div>
            )}

            {/* Examples */}
            <div>
              <p className="text-xs text-slate-600 mb-2 px-1">Beispiele:</p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map(ex => (
                  <button
                    key={ex}
                    onClick={() => handleExample(ex)}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-xs text-slate-500 hover:border-violet-500/30 hover:text-slate-300 transition-colors text-left"
                  >
                    {ex.slice(0, 50)}…
                  </button>
                ))}
              </div>
            </div>
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
                    { key: 'expanding', label: 'Idee analysieren & strukturieren', icon: '🧠' },
                    { key: 'brief',     label: 'Project Brief erstellen',          icon: '📋' },
                    { key: 'items',     label: 'Work Items generieren',            icon: '✅' },
                    { key: 'orchestrating', label: 'Agenten orchestrieren',        icon: '⚙' },
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
            {/* Success header */}
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-5 text-center">
              <p className="text-3xl mb-2">🎉</p>
              <h2 className="text-lg font-bold text-white">{result.briefTitle}</h2>
              <p className="text-sm text-emerald-400 mt-1">
                {result.workItemCount} Work Items erstellt · {result.taskCount} Agenten-Tasks orchestriert
                {autoExecuting && <span className="ml-2 text-violet-400 animate-pulse">· Agenten laufen…</span>}
              </p>
            </div>

            {/* Pipeline summary */}
            <div className="grid grid-cols-3 gap-3">
              <a
                href={`/project-briefs/${result.briefId}`}
                className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-violet-500/30 transition-colors"
              >
                <p className="text-2xl mb-2">📋</p>
                <p className="text-xs text-slate-500 mb-0.5">Project Brief</p>
                <p className="text-sm font-medium text-white group-hover:text-violet-300 transition-colors line-clamp-2">{result.briefTitle}</p>
                <p className="mt-2 text-xs text-violet-400 group-hover:underline">Brief öffnen →</p>
              </a>

              <a
                href="/work-items"
                className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-sky-500/30 transition-colors"
              >
                <p className="text-2xl mb-2">✅</p>
                <p className="text-xs text-slate-500 mb-0.5">Work Items</p>
                <p className="text-sm font-medium text-white">{result.workItemCount} Aufgaben</p>
                <p className="mt-1 text-xs text-slate-500 line-clamp-2">{result.topItem.title}</p>
                <p className="mt-2 text-xs text-sky-400 group-hover:underline">Items ansehen →</p>
              </a>

              <a
                href="/orchestrations"
                className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-emerald-500/30 transition-colors"
              >
                <p className="text-2xl mb-2">⚙</p>
                <p className="text-xs text-slate-500 mb-0.5">Orchestrierung</p>
                <p className="text-sm font-medium text-white">{result.taskCount} Sub-Tasks</p>
                {autoExecuting
                  ? <p className="mt-1 text-xs text-violet-400 animate-pulse">Agenten laufen…</p>
                  : <p className="mt-1 text-xs text-slate-500">Bereit zur Ausführung</p>
                }
                <p className="mt-2 text-xs text-emerald-400 group-hover:underline">Run ansehen →</p>
              </a>
            </div>

            {/* Next delegation */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-xs text-slate-500 mb-1">Nächste Aufgabe für Agenten</p>
              <p className="text-sm font-semibold text-white">{result.topItem.title}</p>
              <p className="text-xs text-slate-500 mt-1">~{result.topItem.estimatedMinutes} Minuten geschätzt</p>
            </div>

            <button
              onClick={handleReset}
              className="w-full rounded-xl border border-white/[0.06] py-3 text-sm text-slate-500 hover:text-slate-300 hover:border-slate-600 transition-colors"
            >
              + Neue Idee eingeben
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
