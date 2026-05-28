'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { DelegationPlan, PlanPhase } from '@/lib/delegations/plan-generator'

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'goal' | 'review' | 'executing'

const RISK_COLORS: Record<string, string> = {
  A: 'bg-green-900/40 text-green-300 border-green-700/50',
  B: 'bg-yellow-900/40 text-yellow-300 border-yellow-700/50',
  C: 'bg-red-900/40 text-red-300 border-red-700/50',
}

const SKILL_ICONS: Record<string, string> = {
  'api-route': '🔌',
  'ui-component': '🎨',
  'data-model': '🗄️',
  'test': '🧪',
  'refactor': '♻️',
  'infrastructure': '⚙️',
  'documentation': '📝',
}

// ─── Phase card ───────────────────────────────────────────────────────────────

function PhaseCard({
  phase,
  index,
  total,
  onUpdate,
}: {
  phase: PlanPhase
  index: number
  total: number
  onUpdate: (updated: PlanPhase) => void
}) {
  const [expanded, setExpanded] = useState(index === 0)

  return (
    <div className="border border-gray-700 rounded-xl bg-gray-900/60 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-800/50 transition-colors"
      >
        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600/30 border border-blue-500/50 flex items-center justify-center text-xs font-bold text-blue-300">
          {index + 1}
        </span>
        <span className="text-sm font-medium text-white flex-1">{phase.title}</span>
        <span className={`text-xs px-2 py-0.5 rounded border ${RISK_COLORS[phase.riskClass] ?? ''}`}>
          Risk {phase.riskClass}
        </span>
        <span className="text-xs text-gray-500">~{phase.estimatedTurns} turns</span>
        {phase.skillCategory && (
          <span className="text-base">{SKILL_ICONS[phase.skillCategory] ?? '🔧'}</span>
        )}
        <span className="text-gray-500 text-xs ml-1">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-700/50">
          {/* Description */}
          <div className="mt-3">
            <label className="text-xs text-gray-500 font-semibold uppercase">Description</label>
            <textarea
              value={phase.description}
              onChange={e => onUpdate({ ...phase, description: e.target.value })}
              rows={2}
              className="mt-1 w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white resize-none focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* DoD Items */}
          <div>
            <label className="text-xs text-gray-500 font-semibold uppercase">Definition of Done</label>
            <div className="mt-1 space-y-1">
              {phase.dodItems.map((item, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <span className="text-gray-600 text-xs">☐</span>
                  <input
                    type="text"
                    value={item}
                    onChange={e => {
                      const updated = [...phase.dodItems]
                      updated[i] = e.target.value
                      onUpdate({ ...phase, dodItems: updated })
                    }}
                    className="flex-1 bg-gray-950 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none"
                  />
                  {phase.dodItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onUpdate({ ...phase, dodItems: phase.dodItems.filter((_, j) => j !== i) })}
                      className="text-gray-600 hover:text-red-400 text-xs"
                    >✕</button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => onUpdate({ ...phase, dodItems: [...phase.dodItems, ''] })}
                className="text-xs text-blue-400 hover:text-blue-300 mt-1"
              >+ Kriterium hinzufügen</button>
            </div>
          </div>

          {/* Files */}
          {(phase.filesToCreate.length > 0 || phase.filesToModify.length > 0) && (
            <div className="flex gap-4 text-xs text-gray-400">
              {phase.filesToCreate.length > 0 && (
                <div>
                  <span className="text-green-500 font-semibold">New: </span>
                  {phase.filesToCreate.join(', ')}
                </div>
              )}
              {phase.filesToModify.length > 0 && (
                <div>
                  <span className="text-yellow-500 font-semibold">Modified: </span>
                  {phase.filesToModify.join(', ')}
                </div>
              )}
            </div>
          )}

          {/* Risk + turns inline edit */}
          <div className="flex gap-3 items-center">
            <label className="text-xs text-gray-500">Risk:</label>
            <select
              value={phase.riskClass}
              onChange={e => onUpdate({ ...phase, riskClass: e.target.value as 'A' | 'B' | 'C' })}
              className="bg-gray-950 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="A">A — Gering</option>
              <option value="B">B — Moderat</option>
              <option value="C">C — Kritisch</option>
            </select>
            <label className="text-xs text-gray-500 ml-2">Turns:</label>
            <input
              type="number"
              min={10}
              max={200}
              value={phase.estimatedTurns}
              onChange={e => onUpdate({ ...phase, estimatedTurns: Number(e.target.value) })}
              className="w-20 bg-gray-950 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Chain position indicator */}
          {total > 1 && (
            <p className="text-xs text-gray-600">
              Phase {index + 1} von {total} — startet {index === 0 ? 'sofort' : `nach Phase ${index}`}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PlanModePage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('goal')

  // Step 1
  const [goal, setGoal] = useState('')
  const [context, setContext] = useState('')
  const [targetRepo, setTargetRepo] = useState('')
  const [workspaces, setWorkspaces] = useState<Array<{ id: string; name: string; path: string; detectedStack?: string }>>([])
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  // Step 2
  const [plan, setPlan] = useState<DelegationPlan | null>(null)
  const [phases, setPhases] = useState<PlanPhase[]>([])
  const [feedback, setFeedback] = useState('')
  const [refining, setRefining] = useState(false)

  // Step 3
  const [executing, setExecuting] = useState(false)
  const [firstDelegationId, setFirstDelegationId] = useState<string | null>(null)
  const [execError, setExecError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/settings/workspaces')
      .then(r => r.json() as Promise<{ workspaces: Array<{ id: string; name: string; path: string; detectedStack?: string }> }>)
      .then(data => setWorkspaces(data.workspaces ?? []))
      .catch(() => setWorkspaces([]))
  }, [])

  const handleGenerate = async () => {
    if (!goal.trim()) return
    setGenerating(true)
    setGenError(null)
    try {
      const res = await fetch('/api/delegations/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: goal.trim(), context: context.trim(), targetRepo: targetRepo.trim() }),
      })
      const data = await res.json() as { plan?: DelegationPlan; error?: string }
      if (!res.ok || !data.plan) {
        setGenError(data.error ?? 'Fehler bei der Plan-Generierung')
        return
      }
      setPlan(data.plan)
      setPhases(data.plan.phases)
      setStep('review')
    } catch {
      setGenError('Netzwerkfehler')
    } finally {
      setGenerating(false)
    }
  }

  const handleRefine = async () => {
    if (!plan || !feedback.trim()) return
    setRefining(true)
    try {
      const res = await fetch(`/api/delegations/plan/${plan.id}/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: feedback.trim() }),
      })
      const data = await res.json() as { plan?: DelegationPlan; error?: string }
      if (res.ok && data.plan) {
        setPlan(data.plan)
        setPhases(data.plan.phases)
        setFeedback('')
      }
    } finally {
      setRefining(false)
    }
  }

  const handleExecute = async () => {
    if (!plan) return
    setExecuting(true)
    setExecError(null)
    try {
      const res = await fetch(`/api/delegations/plan/${plan.id}/execute`, {
        method: 'POST',
      })
      const data = await res.json() as { firstDelegationId?: string; delegationIds?: string[]; message?: string; error?: string }
      if (!res.ok || !data.firstDelegationId) {
        setExecError(data.error ?? 'Fehler beim Starten')
        return
      }
      setFirstDelegationId(data.firstDelegationId)
      setStep('executing')
    } catch {
      setExecError('Netzwerkfehler')
    } finally {
      setExecuting(false)
    }
  }

  const totalTurns = phases.reduce((s, p) => s + p.estimatedTurns, 0)
  const highestRisk = phases.some(p => p.riskClass === 'C') ? 'C' : phases.some(p => p.riskClass === 'B') ? 'B' : 'A'

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">🗂️ Plan Mode</h1>
          <p className="text-sm text-gray-400 mt-1">
            Beschreibe dein Feature → KI erstellt einen Plan mit Phasen → du iterierst → ForgePilot baut autonom.
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-3">
          {(['goal', 'review', 'executing'] as const).map((s, i) => {
            const labels = ['Ziel', 'Plan reviewen', 'Ausführung']
            const active = step === s
            const done = (step === 'review' && i === 0) || (step === 'executing' && i < 2)
            return (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && <div className={`h-px w-8 ${done ? 'bg-blue-500' : 'bg-gray-700'}`} />}
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                  active ? 'bg-blue-600 text-white' : done ? 'bg-blue-900/50 text-blue-300' : 'bg-gray-800 text-gray-500'
                }`}>
                  <span>{done && !active ? '✓' : i + 1}</span>
                  <span>{labels[i]}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* ─── Step 1: Goal ─────────────────────────────────────────────────── */}
        {step === 'goal' && (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase">Feature-Ziel *</label>
              <textarea
                value={goal}
                onChange={e => setGoal(e.target.value)}
                placeholder="Beschreibe das Feature, das du bauen möchtest..."
                rows={4}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white resize-none focus:border-blue-500 focus:outline-none placeholder-gray-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase">Zusätzlicher Kontext (optional)</label>
              <textarea
                value={context}
                onChange={e => setContext(e.target.value)}
                placeholder="Technische Anforderungen, Einschränkungen, Referenzen..."
                rows={2}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white resize-none focus:border-blue-500 focus:outline-none placeholder-gray-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase">Ziel-Repository</label>
              <input
                type="text"
                value={targetRepo}
                onChange={e => setTargetRepo(e.target.value)}
                placeholder="/pfad/zum/repo oder https://github.com/..."
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none placeholder-gray-600"
              />
              {workspaces.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {workspaces.map(ws => (
                    <button
                      key={ws.id}
                      type="button"
                      onClick={() => setTargetRepo(ws.path)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        targetRepo === ws.path
                          ? 'bg-blue-600 text-white border border-blue-500'
                          : 'bg-gray-800 text-gray-300 border border-gray-700 hover:border-blue-600 hover:text-white'
                      }`}
                    >
                      <span>📁</span>
                      <span>{ws.name}</span>
                      {ws.detectedStack && <span className="text-gray-400">· {ws.detectedStack.split(',')[0].trim()}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {genError && <p className="text-sm text-red-400">{genError}</p>}

            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={generating || !goal.trim()}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
            >
              {generating ? '⏳ Plan wird generiert…' : '✨ Plan generieren'}
            </button>
          </div>
        )}

        {/* ─── Step 2: Review plan ──────────────────────────────────────────── */}
        {step === 'review' && plan && (
          <div className="space-y-5">
            {/* Overview */}
            <div className="bg-blue-950/30 border border-blue-800/40 rounded-xl p-4 space-y-1">
              <h2 className="text-sm font-bold text-blue-200">Plan-Übersicht</h2>
              <p className="text-sm text-blue-100/80">{plan.overview}</p>
              <div className="flex gap-4 mt-2 text-xs text-gray-400">
                <span>📋 {phases.length} Phasen</span>
                <span>⏱ ~{totalTurns} Turns</span>
                <span className={`px-2 py-0.5 rounded border ${RISK_COLORS[highestRisk]}`}>Risk {highestRisk}</span>
              </div>
            </div>

            {/* Phase cards */}
            <div className="space-y-3">
              {phases.map((phase, i) => (
                <PhaseCard
                  key={phase.id}
                  phase={phase}
                  index={i}
                  total={phases.length}
                  onUpdate={updated => setPhases(prev => prev.map((p, j) => j === i ? updated : p))}
                />
              ))}
            </div>

            {/* Feedback / refine */}
            <div className="space-y-2 border-t border-gray-800 pt-4">
              <label className="text-xs font-bold text-gray-400 uppercase">Feedback zum Plan (optional)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && feedback.trim()) void handleRefine() }}
                  placeholder="z.B. &quot;Füge Caching zu Phase 2 hinzu&quot; oder &quot;Phase 1 und 2 zusammenfassen&quot;"
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none placeholder-gray-600"
                />
                <button
                  type="button"
                  onClick={() => void handleRefine()}
                  disabled={refining || !feedback.trim()}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-sm font-medium rounded-lg transition-colors"
                >
                  {refining ? '⏳' : '↻ Plan anpassen'}
                </button>
              </div>
            </div>

            {execError && <p className="text-sm text-red-400">{execError}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setStep('goal'); setPlan(null) }}
                className="px-4 py-3 bg-gray-800 hover:bg-gray-700 text-sm font-medium rounded-xl transition-colors"
              >
                ← Zurück
              </button>
              <button
                type="button"
                onClick={() => void handleExecute()}
                disabled={executing || phases.length === 0}
                className="flex-1 py-3 bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors"
              >
                {executing ? '⏳ Starte Delegation-Chain…' : `🚀 Approve & Autonom bauen (${phases.length} Phasen)`}
              </button>
            </div>
          </div>
        )}

        {/* ─── Step 3: Executing ────────────────────────────────────────────── */}
        {step === 'executing' && (
          <div className="space-y-6">
            <div className="bg-green-950/30 border border-green-700/40 rounded-xl p-6 text-center space-y-3">
              <div className="text-4xl">🤖</div>
              <h2 className="text-lg font-bold text-green-200">ForgePilot baut autonom!</h2>
              <p className="text-sm text-green-300/80">
                {plan?.phases.length ?? 0} Phasen wurden als Delegation-Chain erstellt.<br />
                Phase 1 läuft gerade — Phase 2–N starten automatisch danach.
              </p>
            </div>

            <div className="space-y-2">
              {firstDelegationId && (
                <a
                  href={`/delegations/${firstDelegationId}`}
                  className="flex items-center justify-between px-4 py-3 bg-blue-900/30 border border-blue-700/40 rounded-xl hover:bg-blue-900/50 transition-colors"
                >
                  <span className="text-sm text-blue-200">📋 Phase 1 live verfolgen</span>
                  <span className="text-blue-400">→</span>
                </a>
              )}
              <a
                href="/delegations"
                className="flex items-center justify-between px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl hover:bg-gray-800 transition-colors"
              >
                <span className="text-sm text-gray-300">📋 Alle Delegationen anzeigen</span>
                <span className="text-gray-500">→</span>
              </a>
              <button
                type="button"
                onClick={() => { setStep('goal'); setGoal(''); setContext(''); setPlan(null); setPhases([]); setFirstDelegationId(null) }}
                className="w-full px-4 py-3 bg-gray-800 hover:bg-gray-700 text-sm font-medium rounded-xl transition-colors"
              >
                ✨ Neuen Plan erstellen
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
