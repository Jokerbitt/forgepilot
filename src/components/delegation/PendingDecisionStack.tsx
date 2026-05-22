'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { AlertTriangle, Check, ChevronRight, Clock, ExternalLink, X } from 'lucide-react'
import type { Delegation } from '@/lib/models/delegation'
import { cx } from '@/components/ui/primitives'

interface Props {
  delegations: Delegation[]
  onApproved: (id: string) => void
}

const RISK_STYLE: Record<'A' | 'B' | 'C', string> = {
  A: 'border-emerald-700/40 bg-emerald-950/20 text-emerald-400',
  B: 'border-amber-700/40 bg-amber-950/20 text-amber-400',
  C: 'border-rose-700/50 bg-rose-950/25 text-rose-400',
}

function DecisionCard({
  delegation,
  onApproved,
}: {
  delegation: Delegation
  onApproved: (id: string) => void
}) {
  const [approving, setApproving] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const rc = delegation.contract.riskClass
  const isRiskC = rc === 'C'

  const handleApprove = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault()
    if (isRiskC) return
    setApproving(true)
    try {
      const res = await fetch(`/api/delegations/${delegation.id}/approve`, { method: 'POST' })
      if (res.ok) onApproved(delegation.id)
    } finally {
      setApproving(false)
    }
  }, [delegation.id, isRiskC, onApproved])

  if (dismissed) return null

  return (
    <div
      className={cx(
        'flex min-w-[280px] max-w-[320px] shrink-0 flex-col gap-2 rounded-xl border p-3',
        isRiskC
          ? 'border-rose-700/50 bg-rose-950/20'
          : 'border-amber-700/30 bg-amber-950/10',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className={cx(
              'rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase',
              RISK_STYLE[rc],
            )}
          >
            Risk {rc}
          </span>
          {isRiskC && (
            <span className="flex items-center gap-0.5 text-[10px] text-rose-400">
              <AlertTriangle className="h-3 w-3" />
              Manuelle Freigabe
            </span>
          )}
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-slate-600 transition-colors hover:text-slate-400"
          title="Ausblenden"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Title */}
      <p className="line-clamp-2 text-xs font-medium text-white">
        {delegation.title || delegation.contract.goal.slice(0, 80)}
      </p>

      {/* Meta */}
      <div className="flex items-center gap-2 text-[10px] text-slate-500">
        <Clock className="h-3 w-3" />
        <span>{delegation.contract.workItemId || delegation.id.slice(0, 8)}</span>
        <span>·</span>
        <span>${delegation.contract.maxBudgetUsd.toFixed(2)} Budget</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {isRiskC ? (
          <Link
            href={`/delegations/${delegation.id}`}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-rose-700/40 bg-rose-950/30 px-2 py-1.5 text-xs font-semibold text-rose-300 transition-colors hover:bg-rose-950/50"
          >
            <ExternalLink className="h-3 w-3" />
            Prüfen & freigeben
          </Link>
        ) : (
          <>
            <button
              onClick={handleApprove}
              disabled={approving}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-emerald-700/40 bg-emerald-950/30 px-2 py-1.5 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-950/50 disabled:opacity-40"
            >
              <Check className="h-3 w-3" />
              {approving ? 'Freigeben…' : 'Freigeben'}
            </button>
            <Link
              href={`/delegations/${delegation.id}`}
              className="flex items-center justify-center rounded-lg border border-slate-700 px-2 py-1.5 text-slate-500 transition-colors hover:text-slate-300"
              title="Details"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * M257 — Horizontal scroll stack of pending delegations needing a decision.
 * Shows Risk-C first (manual review required), then Risk-B (1-click approve).
 * Only renders when there are pending delegations requiring approval.
 */
export function PendingDecisionStack({ delegations, onApproved }: Props) {
  const pending = delegations
    .filter(d => d.status === 'pending' && d.contract.requiresApproval !== false)
    .sort((a, b) => {
      const order = { C: 0, B: 1, A: 2 }
      return order[a.contract.riskClass] - order[b.contract.riskClass]
    })

  if (pending.length === 0) return null

  return (
    <div className="rounded-xl border border-amber-700/20 bg-amber-950/5 p-3">
      <div className="mb-2.5 flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
        <span className="text-xs font-semibold text-amber-300">
          {pending.length} Entscheidung{pending.length === 1 ? '' : 'en'} ausstehend
        </span>
        <Link
          href="/delegations?approval=approval-required"
          className="ml-auto text-[10px] text-slate-500 transition-colors hover:text-slate-300"
        >
          Alle anzeigen →
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {pending.map(d => (
          <DecisionCard key={d.id} delegation={d} onApproved={onApproved} />
        ))}
      </div>
    </div>
  )
}
