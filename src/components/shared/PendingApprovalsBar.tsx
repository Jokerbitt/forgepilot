'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle, ChevronRight, Clock, X } from 'lucide-react'
import type { Delegation } from '@/lib/models/delegation'

export const MAX_VISIBLE = 3
export const POLL_MS = 15_000

// ── Pure helpers (exported for testing) ─────────────────────────────────────

/** Returns only delegations with status === 'pending'. */
export function filterPendingDelegations(delegations: Delegation[]): Delegation[] {
  return delegations.filter(d => d.status === 'pending')
}

/** Removes just-approved IDs from the visible list. */
export function getVisibleDelegations(
  pending: Delegation[],
  justApproved: Set<string>,
  approving: Set<string>,
): Delegation[] {
  return pending.filter(d => !justApproved.has(d.id) || approving.has(d.id))
}

/** Returns title if non-empty, otherwise the first 45 chars of the goal. */
export function getDelegationLabel(d: Delegation): string {
  return d.title?.trim() || d.contract.goal.slice(0, 45)
}

/**
 * M163 — Sticky approval bar shown at the top of every page when
 * there are delegations waiting for manual approval (status === 'pending').
 *
 * Features:
 * - Shows delegation title + quick-approve button per item (up to MAX_VISIBLE)
 * - Risk-C delegations show a "Risk C" badge instead (manual review required)
 * - Overflow count links to /delegations
 * - Dismiss button (hides until new pending items arrive)
 * - Polls /api/delegations every 15 s; re-shows when dismissed if new items appear
 */
export function PendingApprovalsBar() {
  const [pending, setPending] = useState<Delegation[]>([])
  const [dismissed, setDismissed] = useState(false)
  const [approving, setApproving] = useState<Set<string>>(new Set())
  const [justApproved, setJustApproved] = useState<Set<string>>(new Set())
  // Track previous pending count so we can re-show after new items arrive
  const prevCountRef = useRef(0)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/delegations')
      if (!res.ok) return
      const data = (await res.json()) as Delegation[]
      if (Array.isArray(data)) {
        setPending(data.filter(d => d.status === 'pending'))
      }
    } catch {
      // badge is non-critical
    }
  }, [])

  // Initial load + polling
  useEffect(() => {
    void load()
    const id = window.setInterval(() => void load(), POLL_MS)
    return () => window.clearInterval(id)
  }, [load])

  // Re-show the banner when brand-new pending items arrive after a dismiss
  useEffect(() => {
    const visibleCount = pending.filter(d => !justApproved.has(d.id)).length
    if (dismissed && visibleCount > prevCountRef.current) {
      setDismissed(false)
    }
    prevCountRef.current = visibleCount
  }, [pending, dismissed, justApproved])

  const handleApprove = useCallback(async (id: string) => {
    setApproving(prev => new Set([...prev, id]))
    try {
      const res = await fetch(`/api/delegations/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'approval-bar' }),
      })
      if (res.ok) {
        setJustApproved(prev => new Set([...prev, id]))
        // Remove from visible list after checkmark animation
        window.setTimeout(() => {
          setPending(prev => prev.filter(d => d.id !== id))
          setJustApproved(prev => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
        }, 1200)
      }
    } finally {
      setApproving(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }, [])

  const visiblePending = getVisibleDelegations(pending, justApproved, approving)

  if (dismissed || visiblePending.length === 0) return null

  const shown = visiblePending.slice(0, MAX_VISIBLE)
  const overflow = visiblePending.length - shown.length

  return (
    <div
      data-testid="pending-approvals-bar"
      className="sticky top-12 z-30 border-b border-amber-500/20 bg-amber-500/[0.06] backdrop-blur-sm min-[600px]:top-0"
    >
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
        {/* Label */}
        <div className="flex shrink-0 items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-amber-400" />
          <span className="whitespace-nowrap text-xs font-semibold text-amber-200">
            {visiblePending.length} awaiting approval
          </span>
        </div>

        {/* Delegation chips */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {shown.map(d => {
            const isRiskC = d.contract.riskClass === 'C'
            const isApproving = approving.has(d.id)
            const isApproved = justApproved.has(d.id)
            const label = getDelegationLabel(d)

            return (
              <div
                key={d.id}
                className="flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-1"
              >
                <span className="max-w-[14ch] truncate text-xs font-medium text-slate-200 sm:max-w-[20ch]">
                  {label}
                </span>

                {isRiskC ? (
                  <span
                    data-testid={`risk-c-badge-${d.id}`}
                    className="flex items-center gap-0.5 whitespace-nowrap text-[10px] font-semibold text-rose-400"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    Risk&nbsp;C
                  </span>
                ) : isApproved ? (
                  <CheckCircle
                    data-testid={`approved-icon-${d.id}`}
                    className="h-3.5 w-3.5 text-emerald-400"
                  />
                ) : (
                  <button
                    data-testid={`approve-btn-${d.id}`}
                    onClick={() => void handleApprove(d.id)}
                    disabled={isApproving}
                    className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 transition-colors hover:bg-amber-500/30 disabled:opacity-50"
                  >
                    {isApproving ? '…' : 'Approve'}
                  </button>
                )}
              </div>
            )
          })}

          {overflow > 0 && (
            <Link
              href="/delegations"
              className="whitespace-nowrap text-xs font-medium text-amber-400 hover:text-amber-300 hover:underline"
            >
              +{overflow} more
            </Link>
          )}
        </div>

        {/* View all + dismiss */}
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/delegations"
            className="flex items-center gap-0.5 whitespace-nowrap text-[11px] font-medium text-amber-400/70 transition-colors hover:text-amber-300"
          >
            View all
            <ChevronRight className="h-3 w-3" />
          </Link>
          <button
            data-testid="dismiss-btn"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            className="rounded p-1 text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-slate-300"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
