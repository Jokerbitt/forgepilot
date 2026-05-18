'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type { Delegation } from '@/lib/models/delegation'

export function FailedDelegationsWidget() {
  const [delegations, setDelegations] = useState<Delegation[]>([])
  const [retrying, setRetrying] = useState<Set<string>>(new Set())

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/delegations')
      const data = await res.json() as Delegation[]
      const failed = (data || []).filter(d => d.status === 'failed' || d.status === 'cancelled')
      setDelegations(prev => {
        const prevKey = prev.map(d => `${d.id}:${d.status}`).join(',')
        const nextKey = failed.map((d: Delegation) => `${d.id}:${d.status}`).join(',')
        return prevKey === nextKey ? prev : failed
      })
    } catch {
      // non-critical
    }
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 15000)
    return () => clearInterval(interval)
  }, [refresh])

  const handleRetry = async (id: string) => {
    setRetrying(prev => new Set(prev).add(id))
    try {
      await fetch(`/api/delegations/${id}/retry`, { method: 'POST' })
      await refresh()
    } finally {
      setRetrying(prev => { const next = new Set(prev); next.delete(id); return next })
    }
  }

  if (delegations.length === 0) return null

  const failedCount    = delegations.filter(d => d.status === 'failed').length
  const cancelledCount = delegations.filter(d => d.status === 'cancelled').length
  const top3 = delegations.slice(0, 3)

  return (
    <div className="bg-gray-900 border border-red-900/30 rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <span className="text-red-500">⚠</span>
          Fehlgeschlagen ({delegations.length})
        </h3>
        <Link href="/delegations?status=failed" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          Alle →
        </Link>
      </div>

      <div className="flex gap-2 mb-3">
        {failedCount > 0 && (
          <span className="px-2 py-0.5 text-xs rounded-full bg-red-900/30 border border-red-800/60 text-red-400">
            {failedCount} fehlgeschlagen
          </span>
        )}
        {cancelledCount > 0 && (
          <span className="px-2 py-0.5 text-xs rounded-full bg-gray-800 border border-gray-700 text-gray-500">
            {cancelledCount} abgebrochen
          </span>
        )}
      </div>

      <div className="space-y-2">
        {top3.map(del => (
          <div key={del.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-gray-800/40">
            <Link
              href={`/delegations/${del.id}`}
              className="flex-1 min-w-0 group"
            >
              <div className="text-xs text-gray-300 truncate group-hover:text-white transition-colors">
                {del.title || del.contract.goal}
              </div>
              {del.errorMessage && (
                <div className="text-[10px] text-red-500 truncate mt-0.5">{del.errorMessage}</div>
              )}
              <div className="text-[10px] text-gray-600 font-mono">{del.contract.workItemId}</div>
            </Link>
            <button
              onClick={() => handleRetry(del.id)}
              disabled={retrying.has(del.id)}
              className="shrink-0 px-2 py-1 text-xs bg-yellow-900/40 hover:bg-yellow-900/70 disabled:opacity-50 text-yellow-400 rounded transition-colors"
              title="Erneut einreihen"
            >
              {retrying.has(del.id) ? '⟳' : '🔁'}
            </button>
          </div>
        ))}
        {delegations.length > 3 && (
          <div className="text-xs text-gray-600 text-center pt-1">
            + {delegations.length - 3} weitere →{' '}
            <Link href="/delegations?status=failed" className="text-gray-500 hover:text-gray-300 transition-colors">
              Alle anzeigen
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
