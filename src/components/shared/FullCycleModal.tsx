'use client'

import { useState, useRef } from 'react'
import {
  X, Loader2, CheckCircle2, AlertTriangle, Rocket,
  Search, FileText, CheckSquare, LayoutList, Bot,
} from 'lucide-react'
import Link from 'next/link'
import { cx } from '@/components/ui/primitives'

// ─── Types ────────────────────────────────────────────────────────────────────

type StepStatus = 'idle' | 'running' | 'done' | 'error'

interface StepState {
  status: StepStatus
  label: string
}

interface SSEEvent {
  step?: number
  label?: string
  status?: 'running' | 'done' | 'error'
  researchId?: string
  briefId?: string
  health?: string
  done?: boolean
  error?: string
}

// ─── Step Config ──────────────────────────────────────────────────────────────

const STEP_ICONS = [Search, FileText, CheckSquare, LayoutList, Bot]

const STEP_DEFAULTS: StepState[] = [
  { status: 'idle', label: 'Recherche' },
  { status: 'idle', label: 'Brief erstellen' },
  { status: 'idle', label: 'Brief akzeptieren' },
  { status: 'idle', label: 'Meilensteine' },
  { status: 'idle', label: 'PM Agent' },
]

// ─── Step Item ────────────────────────────────────────────────────────────────

function StepItem({ step, index }: { step: StepState; index: number }) {
  const Icon = STEP_ICONS[index]

  return (
    <div className="flex items-center gap-3">
      <div
        className={cx(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all',
          step.status === 'done'
            ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
            : step.status === 'running'
              ? 'border-violet-500/40 bg-violet-500/15 text-violet-400'
              : step.status === 'error'
                ? 'border-rose-500/40 bg-rose-500/15 text-rose-400'
                : 'border-white/[0.07] bg-white/[0.03] text-slate-600',
        )}
      >
        {step.status === 'done' ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : step.status === 'running' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : step.status === 'error' ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          <Icon className="h-4 w-4" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={cx(
            'text-sm font-medium transition-colors',
            step.status === 'done'
              ? 'text-emerald-400'
              : step.status === 'running'
                ? 'text-white'
                : step.status === 'error'
                  ? 'text-rose-400'
                  : 'text-slate-600',
          )}
        >
          {step.label}
        </p>
      </div>
      <div className="shrink-0">
        {step.status === 'running' && (
          <span className="inline-flex h-2 w-2 rounded-full bg-violet-400 animate-pulse" />
        )}
        {step.status === 'done' && (
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        )}
      </div>
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface FullCycleModalProps {
  onClose: () => void
}

export function FullCycleModal({ onClose }: FullCycleModalProps) {
  const [topic, setTopic] = useState('')
  const [question, setQuestion] = useState('')
  const [steps, setSteps] = useState<StepState[]>(STEP_DEFAULTS)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doneData, setDoneData] = useState<{ briefId: string; researchId: string } | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const updateStep = (index: number, patch: Partial<StepState>) => {
    setSteps(prev => prev.map((s, i) => i === index ? { ...s, ...patch } : s))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!topic.trim() || running) return

    setRunning(true)
    setError(null)
    setDoneData(null)
    setSteps(STEP_DEFAULTS)

    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/full-cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), question: question.trim() || undefined }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('Kein Response-Stream')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6)
          try {
            const event = JSON.parse(raw) as SSEEvent

            if ('error' in event && event.error) {
              setError(event.error)
              setRunning(false)
              return
            }

            if (event.done === true && event.briefId && event.researchId) {
              setDoneData({ briefId: event.briefId, researchId: event.researchId })
              setRunning(false)
              return
            }

            if (event.step !== undefined) {
              const stepIndex = event.step - 1
              if (stepIndex >= 0 && stepIndex < 5) {
                updateStep(stepIndex, {
                  status: event.status ?? 'running',
                  label: event.label ?? STEP_DEFAULTS[stepIndex].label,
                })
              }
            }
          } catch { /* skip malformed lines */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError((err as Error).message)
      }
    } finally {
      setRunning(false)
    }
  }

  const handleCancel = () => {
    abortRef.current?.abort()
    setRunning(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/[0.10] bg-[#0f0f13] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-violet-500/30 bg-violet-500/10">
              <Rocket className="h-4 w-4 text-violet-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Full Cycle starten</h2>
              <p className="text-[11px] text-slate-500">Recherche → Brief → Meilensteine → PM Agent</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={running}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-all hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Form */}
          {!doneData && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                  Thema *
                </label>
                <input
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  placeholder='z.B. "AI-gestützte Wissensarbeit" oder "Microservices vs. Monolith"'
                  className="input-field w-full"
                  required
                  disabled={running}
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                  Forschungsfrage <span className="normal-case font-normal text-slate-600">(optional)</span>
                </label>
                <input
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  placeholder='z.B. "Welche Architektur eignet sich für unser Team?"'
                  className="input-field w-full"
                  disabled={running}
                />
              </div>

              {!running && (
                <button
                  type="submit"
                  disabled={!topic.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-violet-500 disabled:opacity-40"
                >
                  <Rocket className="h-4 w-4" />
                  Full Cycle starten
                </button>
              )}
            </form>
          )}

          {/* Progress Steps */}
          {(running || doneData || error) && (
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3">Fortschritt</p>
              {steps.map((step, i) => (
                <StepItem key={i} step={step} index={i} />
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-rose-300">Fehler</p>
                <p className="text-xs text-rose-300/80 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Done */}
          {doneData && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <p className="text-sm font-bold text-emerald-400">Fertig! Brief erstellt</p>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                Der Full-Cycle-Workflow wurde erfolgreich abgeschlossen.
              </p>
              <Link
                href={`/project-briefs/${doneData.briefId}`}
                className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-emerald-500"
                onClick={onClose}
              >
                <FileText className="h-4 w-4" />
                Brief öffnen
              </Link>
            </div>
          )}

          {/* Running: cancel button */}
          {running && (
            <button
              onClick={handleCancel}
              className="w-full rounded-lg border border-white/[0.07] px-4 py-2 text-sm text-slate-500 transition-all hover:border-white/[0.12] hover:text-slate-300"
            >
              Abbrechen
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
