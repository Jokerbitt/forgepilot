'use client'

import { Suspense, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Play,
  RefreshCw,
  Sparkles,
  Zap,
} from 'lucide-react'
import { cx } from '@/components/ui/primitives'
import type { DelegationPlan, PlanPhase } from '@/lib/delegations/plan-generator'

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'goal' | 'plan' | 'execute'

interface PlanResult {
  plan: DelegationPlan | null
  error: string | null
  loading: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RISK_COLOR: Record<string, string> = {
  A: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  B: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  C: 'bg-red-500/10 text-red-300 border-red-500/20',
}

const RISK_LABEL: Record<string, string> = {
  A: 'Safe — auto-run möglich',
  B: 'Review empfohlen',
  C: 'Manuelle Freigabe nötig',
}

function totalTurns(phases: PlanPhase[]): number {
  return phases.reduce((s, p) => s + p.estimatedTurns, 0)
}

function estimatedCost(phases: PlanPhase[]): string {
  const usd = phases.reduce((s, p) => s + (p.estimatedTurns <= 40 ? 1 : p.estimatedTurns <= 80 ? 2 : 3), 0)
  return `$${usd}`
}

// ─── Step 1: Goal ─────────────────────────────────────────────────────────────

function GoalStep({
  onGenerate,
}: {
  onGenerate: (goal: string, context: string, targetRepo: string, maxPhases: number) => Promise<void>
}) {
  const [goal, setGoal] = useState('')
  const [context, setContext] = useState('')
  const [targetRepo, setTargetRepo] = useState('')
  const [maxPhases, setMaxPhases] = useState(4)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!goal.trim()) return
    setLoading(true)
    setError(null)
    try {
      await onGenerate(goal.trim(), context.trim(), targetRepo.trim(), maxPhases)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Plan-Generierung fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-6">
        <h2 className="text-lg font-bold text-white">Was soll gebaut werden?</h2>
        <p className="mt-1 text-sm text-slate-400">
          Beschreibe das Feature in normaler Sprache. ForgePilot zerlegt es automatisch in ausführbare Phasen.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Feature-Ziel *
            </label>
            <textarea
              value={goal}
              onChange={e => setGoal(e.target.value)}
              rows={3}
              placeholder="z. B. Füge ein vollständiges Pagination-System zur Delegation-Liste hinzu, mit Cursor-basierter API, React-Komponente und Tests."
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/25 resize-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Kontext (optional)
            </label>
            <textarea
              value={context}
              onChange={e => setContext(e.target.value)}
              rows={2}
              placeholder="Stack, Constraints, relevante bestehende Dateien, Deadlines…"
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-violet-500/50 focus:outline-none resize-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Target Repo (optional)
              </label>
              <input
                value={targetRepo}
                onChange={e => setTargetRepo(e.target.value)}
                placeholder="z. B. github.com/org/repo"
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-violet-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Maximale Phasen
              </label>
              <select
                value={maxPhases}
                onChange={e => setMaxPhases(Number(e.target.value))}
                className="w-full rounded-lg border border-white/[0.08] bg-[#0a0a0f] px-4 py-3 text-sm text-white focus:border-violet-500/50 focus:outline-none"
              >
                <option value={2}>2 Phasen — kleines Feature</option>
                <option value={3}>3 Phasen — Multi-Slice MVP</option>
                <option value={4}>4 Phasen — mittleres Feature</option>
                <option value={6}>6 Phasen — Large Feature</option>
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/[0.07] px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            KI zerlegt das Ziel in {maxPhases} unabhängig ausführbare Phasen.
          </p>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || !goal.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-40"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Generiere Plan…</>
            ) : (
              <><Sparkles className="h-4 w-4" />Plan generieren</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Phase Card ───────────────────────────────────────────────────────────────

function PhaseCard({ phase, index, total }: { phase: PlanPhase; index: number; total: number }) {
  const [expanded, setExpanded] = useState(index === 0)

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-white/[0.03] transition"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-xs font-bold text-violet-300">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white">{phase.title}</p>
          <p className="mt-0.5 text-xs text-slate-500 truncate">{phase.description.slice(0, 80)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={cx('rounded-full border px-2 py-0.5 text-[10px] font-bold', RISK_COLOR[phase.riskClass])}>
            Risk {phase.riskClass}
          </span>
          <span className="text-xs text-slate-500">~{phase.estimatedTurns} Turns</span>
          {expanded ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/[0.06] px-5 py-4 space-y-4">
          <p className="text-sm leading-6 text-slate-300">{phase.description}</p>

          <div className="grid gap-4 sm:grid-cols-2">
            {phase.filesToCreate.length > 0 && (
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">Neue Dateien</p>
                <ul className="space-y-1">
                  {phase.filesToCreate.map(f => (
                    <li key={f} className="font-mono text-xs text-slate-400">{f}</li>
                  ))}
                </ul>
              </div>
            )}
            {phase.filesToModify.length > 0 && (
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400">Zu ändern</p>
                <ul className="space-y-1">
                  {phase.filesToModify.map(f => (
                    <li key={f} className="font-mono text-xs text-slate-400">{f}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Definition of Done</p>
            <ul className="space-y-1">
              {phase.dodItems.map(item => (
                <li key={item} className="flex items-start gap-2 text-xs text-slate-400">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className={cx('rounded border px-2 py-0.5 text-[10px] font-semibold', RISK_COLOR[phase.riskClass])}>
              {RISK_LABEL[phase.riskClass]}
            </span>
            <span>Phase {index + 1} von {total}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Step 2: Plan Review ───────────────────────────────────────────────────────

function PlanStep({
  plan,
  onRefine,
  onApprove,
  onBack,
}: {
  plan: DelegationPlan
  onRefine: (feedback: string) => Promise<void>
  onApprove: () => void
  onBack: () => void
}) {
  const [feedback, setFeedback] = useState('')
  const [refining, setRefining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRefine = async () => {
    if (!feedback.trim()) return
    setRefining(true)
    setError(null)
    try {
      await onRefine(feedback.trim())
      setFeedback('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refinement fehlgeschlagen')
    } finally {
      setRefining(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Plan summary */}
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-400">Plan Overview</p>
            <h2 className="mt-1 text-lg font-bold text-white">{plan.overview}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-xs text-slate-400">
            <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1">
              {plan.phases.length} Phasen
            </span>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1">
              ~{totalTurns(plan.phases)} Turns
            </span>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1">
              {estimatedCost(plan.phases)} Budget
            </span>
          </div>
        </div>
      </div>

      {/* Phases */}
      <div className="space-y-3">
        {plan.phases.map((phase, i) => (
          <PhaseCard key={phase.id} phase={phase} index={i} total={plan.phases.length} />
        ))}
      </div>

      {/* Feedback / refine */}
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-5">
        <p className="text-sm font-semibold text-white">Plan anpassen?</p>
        <p className="mt-1 text-xs text-slate-500">
          Beschreibe was geändert werden soll — die KI aktualisiert den Plan entsprechend.
        </p>
        <div className="mt-3 flex gap-3">
          <input
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleRefine() } }}
            placeholder="z. B. Füge Caching zu Phase 2 hinzu. Phase 3 kann mit Phase 4 zusammengeführt werden."
            className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-violet-500/50 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleRefine}
            disabled={refining || !feedback.trim()}
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.09] bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-violet-500/30 hover:bg-violet-500/10 disabled:opacity-40"
          >
            {refining ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Anpassen
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Ziel ändern
        </button>
        <button
          type="button"
          onClick={onApprove}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500"
        >
          <Zap className="h-4 w-4" />
          Autonom ausführen ({plan.phases.length} Phasen)
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Step 3: Execute ──────────────────────────────────────────────────────────

function ExecuteStep({
  plan,
  result,
  onStart,
}: {
  plan: DelegationPlan
  result: { delegationIds: string[]; firstDelegationId: string; phaseCount: number } | null
  onStart: () => Promise<void>
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(result !== null)

  const handleStart = async () => {
    setLoading(true)
    setError(null)
    try {
      await onStart()
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ausführung fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }

  if (done && result) {
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] p-6 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
          <h2 className="mt-3 text-xl font-bold text-white">{result.phaseCount} Delegationen erstellt</h2>
          <p className="mt-2 text-sm text-slate-400">
            Phase 1 ist bereit zum Start. Die folgenden Phasen starten automatisch nach Abschluss der vorherigen.
          </p>
        </div>

        <div className="space-y-2">
          {plan.phases.map((phase, i) => (
            <div
              key={phase.id}
              className={cx(
                'flex items-center gap-4 rounded-lg border px-4 py-3',
                i === 0 ? 'border-violet-500/30 bg-violet-500/[0.07]' : 'border-white/[0.06] bg-white/[0.02]'
              )}
            >
              <span className={cx('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold', i === 0 ? 'bg-violet-500/30 text-violet-200' : 'bg-slate-800 text-slate-400')}>
                {i + 1}
              </span>
              <span className="flex-1 text-sm font-medium text-white">{phase.title}</span>
              <span className={cx('text-xs', i === 0 ? 'text-violet-300' : 'text-slate-500')}>
                {i === 0 ? 'Bereit zum Start' : 'Wartet auf Phase ' + i}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/delegations/plan/${plan.id}`}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500"
          >
            <Play className="h-4 w-4" />
            Plan-Dashboard öffnen
          </Link>
          <Link
            href="/delegations"
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.09] bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-violet-500/30"
          >
            Zur Delegation Queue
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-6">
        <h2 className="text-lg font-bold text-white">Plan bestätigen & ausführen</h2>
        <p className="mt-2 text-sm text-slate-400">
          ForgePilot erstellt {plan.phases.length} Delegationen und verkettet sie. Phase 1 startet sofort — jede weitere Phase startet automatisch nach Abschluss der vorherigen.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-center">
            <p className="text-2xl font-bold text-white">{plan.phases.length}</p>
            <p className="mt-1 text-xs text-slate-500">Phasen</p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-center">
            <p className="text-2xl font-bold text-white">~{totalTurns(plan.phases)}</p>
            <p className="mt-1 text-xs text-slate-500">Agent Turns gesamt</p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-center">
            <p className="text-2xl font-bold text-white">{estimatedCost(plan.phases)}</p>
            <p className="mt-1 text-xs text-slate-500">Budget</p>
          </div>
        </div>

        {plan.phases.some(p => p.riskClass === 'C') && (
          <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/[0.07] px-4 py-3 text-xs text-amber-300">
            ⚠ Eine oder mehrere Phasen haben Risk Class C und benötigen manuelle Freigabe vor der Ausführung.
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/[0.07] px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Plan überarbeiten
        </button>
        <button
          type="button"
          onClick={handleStart}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-40"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Erstelle Chain…</>
          ) : (
            <><Zap className="h-4 w-4" />Jetzt autonom starten</>
          )}
        </button>
      </div>
    </div>
  )
}

// ─── Wizard ───────────────────────────────────────────────────────────────────

function PlanWizardInner() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('goal')
  const [planResult, setPlanResult] = useState<PlanResult>({ plan: null, error: null, loading: false })
  const [executeResult, setExecuteResult] = useState<{
    delegationIds: string[]
    firstDelegationId: string
    phaseCount: number
  } | null>(null)

  const handleGenerate = async (goal: string, context: string, targetRepo: string, maxPhases: number) => {
    const res = await fetch('/api/delegations/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal, context, targetRepo: targetRepo || undefined, maxPhases }),
    })
    if (!res.ok) {
      const data = await res.json() as { error?: string }
      throw new Error(data.error ?? 'Plan-Generierung fehlgeschlagen')
    }
    const plan = await res.json() as DelegationPlan
    setPlanResult({ plan, error: null, loading: false })
    setStep('plan')
  }

  const handleRefine = async (feedback: string) => {
    if (!planResult.plan) return
    const res = await fetch(`/api/delegations/plan/${planResult.plan.id}/refine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback }),
    })
    if (!res.ok) {
      const data = await res.json() as { error?: string }
      throw new Error(data.error ?? 'Refinement fehlgeschlagen')
    }
    const updated = await res.json() as DelegationPlan
    setPlanResult(prev => ({ ...prev, plan: updated }))
  }

  const handleApprove = () => setStep('execute')

  const handleExecute = async () => {
    if (!planResult.plan) return
    const res = await fetch(`/api/delegations/plan/${planResult.plan.id}/execute`, {
      method: 'POST',
    })
    if (!res.ok) {
      const data = await res.json() as { error?: string }
      throw new Error(data.error ?? 'Ausführung fehlgeschlagen')
    }
    const result = await res.json() as { delegationIds: string[]; firstDelegationId: string; phaseCount: number }
    setExecuteResult(result)
  }

  const steps: { key: Step; label: string }[] = [
    { key: 'goal', label: 'Ziel definieren' },
    { key: 'plan', label: 'Plan prüfen' },
    { key: 'execute', label: 'Autonom starten' },
  ]

  return (
    <main className="min-h-screen bg-[#08080d] px-5 py-6 text-slate-100 lg:px-8">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <Link href="/delegations" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition">
            <ArrowLeft className="h-4 w-4" />
            Zur Delegation Queue
          </Link>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Plan Mode</h1>
              <p className="text-sm text-slate-400">Große Features autonom planen und ausführen</p>
            </div>
          </div>
        </div>

        {/* Step indicator */}
        <div className="mb-8 flex items-center gap-2">
          {steps.map((s, i) => {
            const current = s.key === step
            const done = steps.findIndex(x => x.key === step) > i
            return (
              <div key={s.key} className="flex items-center gap-2">
                <div className={cx(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold',
                  current ? 'bg-violet-500 text-white' :
                  done ? 'bg-emerald-500/20 text-emerald-300' :
                  'bg-white/[0.05] text-slate-500'
                )}>
                  {done ? '✓' : i + 1}
                </div>
                <span className={cx('text-sm font-medium', current ? 'text-white' : done ? 'text-slate-400' : 'text-slate-600')}>
                  {s.label}
                </span>
                {i < steps.length - 1 && (
                  <div className={cx('h-px w-8 mx-1', done ? 'bg-emerald-500/30' : 'bg-white/[0.06]')} />
                )}
              </div>
            )
          })}
        </div>

        {/* Step content */}
        {step === 'goal' && (
          <GoalStep onGenerate={handleGenerate} />
        )}
        {step === 'plan' && planResult.plan && (
          <PlanStep
            plan={planResult.plan}
            onRefine={handleRefine}
            onApprove={handleApprove}
            onBack={() => setStep('goal')}
          />
        )}
        {step === 'execute' && planResult.plan && (
          <ExecuteStep
            plan={planResult.plan}
            result={executeResult}
            onStart={handleExecute}
          />
        )}
      </div>
    </main>
  )
}

export default function PlanPage() {
  return (
    <Suspense>
      <PlanWizardInner />
    </Suspense>
  )
}
