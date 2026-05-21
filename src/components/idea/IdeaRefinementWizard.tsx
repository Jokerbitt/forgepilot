'use client'

/**
 * IdeaRefinementWizard — M136
 *
 * A 3-step dialog that refines a raw idea into a structured project brief:
 *   Step 1 (enter)     — user types their idea
 *   Step 2 (questions) — AI generates 4 clarifying questions, user answers
 *   Step 3 (brief)     — AI synthesises enriched brief; user can submit
 */

import { useState } from 'react'
import type { RefinedBriefDraft } from '@/app/api/idea/refine/route'

type WizardStep = 'enter' | 'loading-questions' | 'questions' | 'loading-brief' | 'brief' | 'done'

interface Props {
  onClose: () => void
  onBriefReady: (idea: string, brief: RefinedBriefDraft) => void
  initialIdea?: string
}

export function IdeaRefinementWizard({ onClose, onBriefReady, initialIdea = '' }: Props) {
  const [step, setStep] = useState<WizardStep>('enter')
  const [idea, setIdea] = useState(initialIdea)
  const [questions, setQuestions] = useState<string[]>([])
  const [answers, setAnswers] = useState<string[]>([])
  const [brief, setBrief] = useState<RefinedBriefDraft | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleGenerateQuestions = async () => {
    if (idea.trim().length < 10) {
      setError('Idee muss mindestens 10 Zeichen haben.')
      return
    }
    setError(null)
    setStep('loading-questions')
    try {
      const res = await fetch('/api/idea/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: idea.trim() }),
      })
      const data = await res.json() as { phase: string; questions?: string[]; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Fehler beim Laden der Fragen')
      setQuestions(data.questions ?? [])
      setAnswers((data.questions ?? []).map(() => ''))
      setStep('questions')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
      setStep('enter')
    }
  }

  const handleGenerateBrief = async () => {
    const qa = questions.map((q, i) => ({ question: q, answer: answers[i] ?? '' }))
    setStep('loading-brief')
    setError(null)
    try {
      const res = await fetch('/api/idea/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: idea.trim(), answers: qa }),
      })
      const data = await res.json() as { phase: string; brief?: RefinedBriefDraft; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Fehler beim Erstellen des Briefs')
      setBrief(data.brief ?? null)
      setStep('brief')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
      setStep('questions')
    }
  }

  const handleSubmitBrief = () => {
    if (!brief) return
    onBriefReady(idea, brief)
    setStep('done')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-6 py-4 bg-gray-950 border-b border-gray-800">
          <div>
            <h2 className="text-sm font-semibold text-white">✨ Idee verfeinern</h2>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {step === 'enter' && 'Schritt 1 — Idee beschreiben'}
              {(step === 'loading-questions' || step === 'questions') && 'Schritt 2 — Klärungsfragen beantworten'}
              {(step === 'loading-brief' || step === 'brief') && 'Schritt 3 — Verfeinerter Brief'}
              {step === 'done' && 'Fertig!'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors text-lg leading-none">×</button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">
              ⚠ {error}
            </div>
          )}

          {/* Step 1: Enter idea */}
          {(step === 'enter' || step === 'loading-questions') && (
            <>
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1.5">Deine Idee</label>
                <textarea
                  value={idea}
                  onChange={e => setIdea(e.target.value)}
                  placeholder="Beschreibe deine Idee in 1-3 Sätzen..."
                  rows={4}
                  disabled={step === 'loading-questions'}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-violet-600 disabled:opacity-50"
                />
                <p className="text-[10px] text-gray-600 mt-1">{idea.length} Zeichen</p>
              </div>
              <button
                onClick={handleGenerateQuestions}
                disabled={idea.trim().length < 10 || step === 'loading-questions'}
                className="w-full py-2.5 text-sm font-medium bg-violet-900/50 hover:bg-violet-900/80 text-violet-300 border border-violet-800 rounded-xl transition-colors disabled:opacity-40">
                {step === 'loading-questions' ? '⏳ KI generiert Fragen…' : '→ Fragen generieren'}
              </button>
            </>
          )}

          {/* Step 2: Answer questions */}
          {(step === 'questions' || step === 'loading-brief') && (
            <>
              <p className="text-xs text-gray-500">Die KI hat folgende Fragen um deinen Brief zu verbessern. Beantworte sie so detailliert wie möglich.</p>
              <div className="space-y-4">
                {questions.map((q, i) => (
                  <div key={i}>
                    <label className="text-xs font-medium text-gray-400 block mb-1.5">
                      <span className="text-violet-400 mr-1">{i + 1}.</span>{q}
                    </label>
                    <textarea
                      value={answers[i] ?? ''}
                      onChange={e => {
                        const next = [...answers]
                        next[i] = e.target.value
                        setAnswers(next)
                      }}
                      placeholder="Deine Antwort…"
                      rows={2}
                      disabled={step === 'loading-brief'}
                      className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-violet-600 disabled:opacity-50"
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep('enter')}
                  disabled={step === 'loading-brief'}
                  className="px-4 py-2 text-xs text-gray-400 hover:text-gray-200 border border-gray-700 rounded-xl transition-colors disabled:opacity-40">
                  ← Zurück
                </button>
                <button
                  onClick={handleGenerateBrief}
                  disabled={step === 'loading-brief'}
                  className="flex-1 py-2 text-sm font-medium bg-violet-900/50 hover:bg-violet-900/80 text-violet-300 border border-violet-800 rounded-xl transition-colors disabled:opacity-40">
                  {step === 'loading-brief' ? '⏳ Brief wird erstellt…' : '→ Brief generieren'}
                </button>
              </div>
            </>
          )}

          {/* Step 3: Preview brief */}
          {step === 'brief' && brief && (
            <>
              <div className="space-y-3">
                <BriefField label="Titel" value={brief.title} />
                <BriefField label="Problem" value={brief.problemStatement} />
                <BriefField label="Gewünschtes Ergebnis" value={brief.desiredOutcome} />
                <BriefField label="Zielgruppe" value={brief.targetAudience} />
                {brief.technicalConstraints && (
                  <BriefField label="Technische Einschränkungen" value={brief.technicalConstraints} />
                )}
                <BriefListField label="Erfolgskriterien" items={brief.successCriteria} color="text-green-400" />
                <BriefListField label="Nicht-Ziele" items={brief.nonGoals} color="text-orange-400" />
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>Scope:</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] border ${
                    brief.scope === 'full' ? 'bg-blue-950/30 text-blue-400 border-blue-800' :
                    brief.scope === 'minimal' ? 'bg-gray-900 text-gray-400 border-gray-700' :
                    'bg-green-950/30 text-green-400 border-green-800'
                  }`}>{brief.scope}</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep('questions')}
                  className="px-4 py-2 text-xs text-gray-400 hover:text-gray-200 border border-gray-700 rounded-xl transition-colors">
                  ← Antworten bearbeiten
                </button>
                <button
                  onClick={handleSubmitBrief}
                  className="flex-1 py-2.5 text-sm font-medium bg-emerald-900/50 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800 rounded-xl transition-colors">
                  ✓ Brief übernehmen
                </button>
              </div>
            </>
          )}

          {step === 'done' && (
            <div className="text-center py-8">
              <p className="text-2xl mb-2">✅</p>
              <p className="text-sm text-gray-300">Brief erfolgreich übernommen!</p>
              <button onClick={onClose} className="mt-4 px-4 py-2 text-xs text-gray-400 hover:text-gray-200 border border-gray-700 rounded-xl">
                Schließen
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function BriefField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm text-gray-300">{value}</p>
    </div>
  )
}

function BriefListField({ label, items, color }: { label: string; items: string[]; color: string }) {
  if (!items.length) return null
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <ul className="space-y-0.5">
        {items.map((item, i) => (
          <li key={i} className={`text-sm flex items-start gap-1.5 ${color}`}>
            <span className="mt-0.5 opacity-60">•</span> {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
