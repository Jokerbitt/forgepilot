'use client'

import { useState } from 'react'
import type { PilotRunResult, PilotStep } from '@/lib/pilot/types'
import { cx } from '@/components/ui/primitives'

interface Props {
  workItemId: string
  title: string
  goal: string
  privacyMode?: 'local-only' | 'hybrid' | 'cloud-approved'
  riskClass?: 'A' | 'B' | 'C'
  maxBudgetUsd?: number
  delegationId?: string
  onRunCreated?: (agentRunId: string) => void
}

function stepColor(status: PilotStep['status']): string {
  if (status === 'ok') return 'text-emerald-400'
  if (status === 'error') return 'text-red-400'
  if (status === 'skipped') return 'text-amber-400'
  return 'text-slate-500'
}

function stepIcon(status: PilotStep['status']): string {
  if (status === 'ok') return '✓'
  if (status === 'error') return '✗'
  if (status === 'skipped') return '—'
  return '○'
}

const STEP_LABELS: Record<string, string> = {
  'policy-check': 'Policy Check',
  'model-routing': 'Model Routing',
  'agent-selection': 'Agent Selection',
  'agent-run-create': 'Agent Run erstellen',
  'writeback': 'Knowledge Writeback',
}

export function PipelineRunner({
  workItemId, title, goal,
  privacyMode = 'hybrid',
  riskClass = 'A',
  maxBudgetUsd = 5,
  delegationId,
  onRunCreated,
}: Props) {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<PilotRunResult | null>(null)
  const [error, setError] = useState('')

  const handleRun = async () => {
    setRunning(true)
    setResult(null)
    setError('')
    try {
      const res = await fetch('/api/pilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workItemId, title, goal, privacyMode, riskClass, maxBudgetUsd }),
      })
      const data = await res.json() as PilotRunResult
      setResult(data)
      const agentRunId = data.agentRunId
      if (agentRunId) {
        onRunCreated?.(agentRunId)
        // Link the agent run back to the delegation and trigger execution
        if (delegationId) {
          await fetch(`/api/delegations/${delegationId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentRunId, status: 'running' }),
          }).catch(() => {/* best-effort */})
          // Auto-trigger execution for Risk A/B (non-critical) delegations
          if (riskClass !== 'C') {
            fetch(`/api/delegations/${delegationId}/execute`, {
              method: 'POST',
            }).catch(() => {/* best-effort — Claude CLI may not be available */})
          }
        }
      }
    } catch {
      setError('Verbindungsfehler')
    } finally {
      setRunning(false)
    }
  }

  if (result) {
    const allOk = result.steps.every(s => s.status === 'ok')
    return (
      <div className={cx(
        'col-span-2 rounded-lg border p-3',
        allOk ? 'border-emerald-800/40 bg-emerald-900/10' : 'border-amber-800/40 bg-amber-900/10'
      )}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Pipeline</p>
          <div className="flex items-center gap-2">
            <span className={cx('text-xs font-semibold', allOk ? 'text-emerald-400' : 'text-amber-300')}>
              {allOk ? 'Erfolgreich' : 'Mit Warnungen'}
            </span>
            <button
              onClick={() => { setResult(null); setError('') }}
              className="text-xs text-slate-600 hover:text-slate-400"
            >
              Neu starten
            </button>
          </div>
        </div>
        <div className="space-y-1">
          {result.steps.map(step => (
            <div key={step.step} className="flex items-center gap-2">
              <span className={cx('w-4 shrink-0 text-center text-xs font-bold', stepColor(step.status))}>
                {stepIcon(step.status)}
              </span>
              <span className="flex-1 text-xs text-slate-400">
                {STEP_LABELS[step.step] ?? step.step}
              </span>
              <span className="shrink-0 text-xs text-slate-600">{step.durationMs}ms</span>
            </div>
          ))}
        </div>
        {result.agentRunId && (
          <div className="mt-2 border-t border-slate-700/50 pt-2">
            <a
              href={`/agent-runs/${result.agentRunId}`}
              className="text-xs font-medium text-sky-400 hover:underline"
            >
              Agent Run ansehen →
            </a>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="col-span-2 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-300">Pipeline starten</p>
          <p className="mt-0.5 text-xs text-slate-600">
            Policy → Model Routing → Agent → Run → Writeback
          </p>
        </div>
        <button
          onClick={handleRun}
          disabled={running}
          className={cx(
            'shrink-0 rounded px-3 py-1.5 text-xs font-semibold transition-colors',
            running
              ? 'bg-slate-700 text-slate-400'
              : 'bg-sky-600 text-white hover:bg-sky-500'
          )}
        >
          {running ? 'Läuft…' : '▶ Run'}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  )
}
