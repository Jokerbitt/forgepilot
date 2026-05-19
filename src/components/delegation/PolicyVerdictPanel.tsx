'use client'

import { useEffect, useState } from 'react'
import type { TaskContract } from '@/lib/models/delegation'
import type { PolicyDecision } from '@/lib/policy/types'
import { cx } from '@/components/ui/primitives'

const VERDICT_STYLES = {
  allow: {
    border: 'border-emerald-800/50',
    bg: 'bg-emerald-900/10',
    dot: 'bg-emerald-500',
    label: 'Freigegeben',
    labelColor: 'text-emerald-400',
  },
  review: {
    border: 'border-amber-800/50',
    bg: 'bg-amber-900/10',
    dot: 'bg-amber-400',
    label: 'Review erforderlich',
    labelColor: 'text-amber-300',
  },
  deny: {
    border: 'border-red-800/50',
    bg: 'bg-red-900/10',
    dot: 'bg-red-500',
    label: 'Blockiert',
    labelColor: 'text-red-400',
  },
}

interface Props {
  contract: TaskContract
}

export function PolicyVerdictPanel({ contract }: Props) {
  const [decision, setDecision] = useState<PolicyDecision | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch('/api/policy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contract),
    })
      .then(r => r.json())
      .then((d: PolicyDecision) => setDecision(d))
      .catch(() => setDecision(null))
      .finally(() => setLoading(false))
  }, [contract.id, contract.riskClass, contract.maxBudgetUsd, contract.allowedTools?.join(','), contract.privacyMode]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Policy Check</p>
        <p className="mt-2 text-xs text-slate-600">Prüfe…</p>
      </div>
    )
  }

  if (!decision) return null

  const style = VERDICT_STYLES[decision.verdict]

  return (
    <div className={cx('rounded-lg border p-3', style.border, style.bg)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Policy Check</p>
        <div className="flex items-center gap-1.5">
          <span className={cx('h-2 w-2 rounded-full', style.dot)} />
          <span className={cx('text-xs font-semibold', style.labelColor)}>{style.label}</span>
        </div>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-slate-400">{decision.reason}</p>

      {decision.violations.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {decision.violations.map(v => (
            <li key={v.ruleId} className="flex items-start gap-2 text-xs">
              <span className={cx(
                'mt-0.5 shrink-0 rounded px-1 py-0.5 font-mono text-[10px] font-bold',
                v.severity === 'blocking'
                  ? 'bg-red-900/40 text-red-300'
                  : 'bg-amber-900/40 text-amber-300'
              )}>
                {v.ruleId}
              </span>
              <span className="text-slate-400">{v.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
