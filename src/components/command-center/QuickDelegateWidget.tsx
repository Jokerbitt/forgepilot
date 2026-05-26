'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cx } from '@/components/ui/primitives'

const BUDGET_OPTIONS = [
  { label: '$0.50', value: 0.5 },
  { label: '$1', value: 1 },
  { label: '$2', value: 2 },
  { label: '$5', value: 5 },
]

const MODEL_OPTIONS = [
  { label: 'Sonnet 4.6', value: 'claude-sonnet-4-6', description: 'Empfohlen' },
  { label: 'Haiku 4.5', value: 'claude-haiku-4-5', description: 'Schnell' },
  { label: 'Opus 4.7', value: 'claude-opus-4-7', description: 'Komplex' },
]

type Phase = 'idle' | 'creating' | 'executing' | 'done' | 'error'

interface QuickDelegateWidgetProps {
  className?: string
}

export function QuickDelegateWidget({ className }: QuickDelegateWidgetProps) {
  const router = useRouter()
  const [goal, setGoal] = useState('')
  const [budget, setBudget] = useState(1)
  const [model, setModel] = useState('claude-sonnet-4-6')
  const [phase, setPhase] = useState<Phase>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [delegationId, setDelegationId] = useState<string | null>(null)

  const canSubmit = goal.trim().length >= 20 && phase === 'idle'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return

    setPhase('creating')
    setErrorMsg('')

    try {
      // Step 1: Create delegation
      const createRes = await fetch('/api/delegations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: goal.trim().slice(0, 80),
          contract: {
            goal: goal.trim(),
            riskClass: 'A',
            privacyMode: 'local',
            requiresApproval: false,
            maxBudgetUsd: budget,
            llmModel: model,
            skillCategory: 'infrastructure',
            acceptanceCriteria: ['Tests pass', 'No type errors', 'PR created'],
          },
        }),
      })
      if (!createRes.ok) throw new Error(`Create failed: ${createRes.status}`)
      const delegation = await createRes.json() as { id: string }
      setDelegationId(delegation.id)

      // Step 2: Approve (Risk A — auto-approve)
      await fetch(`/api/delegations/${delegation.id}/approve`, { method: 'POST' })

      // Step 3: Execute (fire-and-forget — runs async on server)
      setPhase('executing')
      await fetch(`/api/delegations/${delegation.id}/execute`, { method: 'POST' })

      setPhase('done')

      // Navigate to live view after short delay
      setTimeout(() => {
        router.push(`/delegations/${delegation.id}`)
      }, 800)
    } catch (err) {
      setPhase('error')
      setErrorMsg(err instanceof Error ? err.message : 'Unbekannter Fehler')
    }
  }

  const handleReset = () => {
    setPhase('idle')
    setErrorMsg('')
    setGoal('')
    setDelegationId(null)
  }

  return (
    <div className={cx('rounded-xl border border-slate-800 bg-slate-900/60 p-5', className)}>
      <div className="mb-4 flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400">
          ⚡
        </span>
        <div>
          <p className="text-sm font-semibold text-white">Quick Delegate</p>
          <p className="text-xs text-slate-500">Aufgabe formulieren → Agent startet sofort</p>
        </div>
      </div>

      {phase === 'done' && delegationId ? (
        <div className="rounded-lg border border-emerald-800/60 bg-emerald-950/40 p-4 text-center">
          <p className="text-sm font-medium text-emerald-300">✓ Agent gestartet</p>
          <p className="mt-1 text-xs text-slate-400">Weiterleitung zur Live-Ansicht…</p>
          <button
            onClick={() => router.push(`/delegations/${delegationId}`)}
            className="mt-3 text-xs font-medium text-sky-400 hover:underline"
          >
            Jetzt öffnen →
          </button>
        </div>
      ) : phase === 'error' ? (
        <div className="rounded-lg border border-red-800/60 bg-red-950/40 p-4">
          <p className="text-sm font-medium text-red-300">Fehler beim Starten</p>
          <p className="mt-1 text-xs text-slate-400">{errorMsg}</p>
          <button onClick={handleReset} className="mt-3 text-xs font-medium text-sky-400 hover:underline">
            Erneut versuchen
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Goal input */}
          <div>
            <textarea
              value={goal}
              onChange={e => setGoal(e.target.value)}
              placeholder="Beschreibe die Aufgabe für den Agenten… (mind. 20 Zeichen)"
              rows={3}
              disabled={phase !== 'idle'}
              className={cx(
                'w-full resize-none rounded-lg border bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-600',
                'focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600',
                phase !== 'idle' ? 'cursor-not-allowed opacity-60' : 'border-slate-700',
              )}
            />
            {goal.length > 0 && goal.trim().length < 20 && (
              <p className="mt-1 text-xs text-amber-500">
                Noch {20 - goal.trim().length} Zeichen bis Mindestlänge
              </p>
            )}
          </div>

          {/* Config row */}
          <div className="flex items-center gap-3">
            {/* Model */}
            <div className="flex-1">
              <label className="mb-1 block text-xs text-slate-500">Modell</label>
              <select
                value={model}
                onChange={e => setModel(e.target.value)}
                disabled={phase !== 'idle'}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white focus:border-sky-600 focus:outline-none disabled:opacity-60"
              >
                {MODEL_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label} — {o.description}</option>
                ))}
              </select>
            </div>

            {/* Budget */}
            <div>
              <label className="mb-1 block text-xs text-slate-500">Budget</label>
              <div className="flex gap-1">
                {BUDGET_OPTIONS.map(o => (
                  <button
                    key={o.value}
                    type="button"
                    disabled={phase !== 'idle'}
                    onClick={() => setBudget(o.value)}
                    className={cx(
                      'rounded px-2 py-1 text-xs font-medium transition-colors',
                      budget === o.value
                        ? 'bg-sky-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 disabled:opacity-60',
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit || phase !== 'idle'}
            className={cx(
              'w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-all',
              canSubmit && phase === 'idle'
                ? 'bg-sky-600 text-white hover:bg-sky-500'
                : 'cursor-not-allowed bg-slate-800 text-slate-500',
            )}
          >
            {phase === 'creating' ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Delegation wird erstellt…
              </span>
            ) : phase === 'executing' ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Agent wird gestartet…
              </span>
            ) : (
              '⚡ Starten'
            )}
          </button>
        </form>
      )}
    </div>
  )
}
