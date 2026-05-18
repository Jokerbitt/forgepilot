'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type { Delegation } from '@/lib/models/delegation'

const RISK_LABEL: Record<string, string> = { A: '🟢', B: '🟡', C: '🔴' }

/**
 * Dashboard widget: shows pending/approved delegations when nothing is running.
 * Only renders when there are items waiting (not running — ActiveAgentsPanel handles that).
 */
export function DelegationQueueSummary() {
  const [delegations, setDelegations] = useState<Delegation[]>([])

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/delegations')
      const data = await res.json() as Delegation[]
      const waiting = (data || []).filter(d => d.status === 'pending' || d.status === 'approved')
      setDelegations(prev => {
        const prevKey = prev.map(d => `${d.id}:${d.status}`).join(',')
        const nextKey = waiting.map((d: Delegation) => `${d.id}:${d.status}`).join(',')
        return prevKey === nextKey ? prev : waiting
      })
    } catch {
      // ignore — non-critical widget
    }
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 10000)
    return () => clearInterval(interval)
  }, [refresh])

  const handleBatchApprove = async () => {
    const approvable = delegations.filter(
      d => d.status === 'pending' && d.contract.requiresApproval && d.contract.riskClass !== 'C'
    )
    if (approvable.length === 0) return
    const now = new Date().toISOString()
    const updates = approvable.map(d => ({
      ...d,
      status: 'approved' as const,
      contract: { ...d.contract, requiresApproval: false },
      logs: [...(d.logs ?? []), { timestamp: now, type: 'success' as const, message: 'Batch-freigegeben.' }],
      updatedAt: now,
    }))
    // Optimistic
    setDelegations(prev => prev.map(d => {
      const upd = updates.find(u => u.id === d.id)
      return upd ? { ...d, status: 'approved' as const } : d
    }))
    await fetch('/api/delegations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    await refresh()
  }

  if (delegations.length === 0) return null

  const pendingCount  = delegations.filter(d => d.status === 'pending').length
  const approvedCount = delegations.filter(d => d.status === 'approved').length
  const approvableCount = delegations.filter(
    d => d.status === 'pending' && d.contract.requiresApproval && d.contract.riskClass !== 'C'
  ).length
  const top3 = delegations.slice(0, 3)

  return (
    <div className="bg-gray-900 border border-yellow-900/30 rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <span className="text-yellow-500">⏳</span>
          Delegation-Queue ({delegations.length})
        </h3>
        <div className="flex items-center gap-2">
          {approvableCount > 0 && (
            <button
              onClick={handleBatchApprove}
              className="text-xs text-green-400 hover:text-green-300 border border-green-900/60 hover:border-green-700 hover:bg-green-900/20 px-2 py-1 rounded-lg transition-colors"
              title={`${approvableCount} Delegation${approvableCount > 1 ? 'en' : ''} freigeben`}
            >
              ✔ Alle freigeben ({approvableCount})
            </button>
          )}
          <Link
            href="/delegations"
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Alle →
          </Link>
        </div>
      </div>

      {/* Status summary chips */}
      <div className="flex gap-2 mb-3">
        {pendingCount > 0 && (
          <Link href="/delegations?status=pending"
            className="px-2 py-0.5 text-xs rounded-full bg-yellow-900/30 border border-yellow-800/60 text-yellow-400 hover:bg-yellow-900/50 transition-colors">
            {pendingCount} ausstehend
          </Link>
        )}
        {approvedCount > 0 && (
          <Link href="/delegations?status=approved"
            className="px-2 py-0.5 text-xs rounded-full bg-blue-900/30 border border-blue-800/60 text-blue-400 hover:bg-blue-900/50 transition-colors">
            {approvedCount} genehmigt
          </Link>
        )}
      </div>

      {/* Top 3 waiting items */}
      <div className="space-y-2">
        {top3.map(del => (
          <Link
            key={del.id}
            href={`/delegations/${del.id}`}
            className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-800/60 transition-colors group"
          >
            <span className="text-xs" title={`Risk ${del.contract.riskClass}`}>
              {RISK_LABEL[del.contract.riskClass] ?? '⚪'}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-300 truncate group-hover:text-white transition-colors">
                {del.title || del.contract.goal}
              </div>
              <div className="text-[10px] text-gray-600 font-mono">{del.contract.workItemId}</div>
            </div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${
              del.status === 'approved'
                ? 'bg-blue-950/50 text-blue-400 border-blue-900/50'
                : 'bg-yellow-950/50 text-yellow-600 border-yellow-900/50'
            }`}>
              {del.status === 'approved' ? 'genehmigt' : 'ausstehend'}
            </span>
          </Link>
        ))}
        {delegations.length > 3 && (
          <div className="text-xs text-gray-600 text-center pt-1">
            + {delegations.length - 3} weitere →{' '}
            <Link href="/delegations" className="text-gray-500 hover:text-gray-300 transition-colors">
              Alle anzeigen
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
