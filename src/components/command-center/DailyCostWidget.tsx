'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Stats {
  total: number
  running: number
  pending: number
  completed: number
  failed: number
  totalEstimatedUsd: number
  totalActualUsd: number
  todayCount: number
  todayActualUsd: number
}

/**
 * Compact dashboard widget: shows today's delegation activity and costs.
 * Uses GET /api/delegations/stats — lightweight, no full payload.
 */
export function DailyCostWidget() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/delegations/stats')
        if (res.ok) setStats(await res.json() as Stats)
      } catch {
        // non-critical widget
      }
    }
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [])

  if (!stats || (stats.total === 0)) return null

  const hasActualCost = stats.totalActualUsd > 0
  const hasRunning    = stats.running > 0

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
          <span>📊</span> Heute
        </h3>
        <Link href="/delegations" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
          Details →
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Today's delegation count */}
        <div className="text-center">
          <div className="text-xl font-bold text-white">{stats.todayCount}</div>
          <div className="text-[10px] text-gray-600 uppercase tracking-wide mt-0.5">Heute</div>
        </div>

        {/* Running */}
        <div className="text-center">
          <div className={`text-xl font-bold ${hasRunning ? 'text-green-400' : 'text-gray-600'}`}>
            {stats.running}
          </div>
          <div className="text-[10px] text-gray-600 uppercase tracking-wide mt-0.5">Läuft</div>
        </div>

        {/* Total actual cost */}
        <div className="text-center">
          <div className={`text-xl font-bold font-mono ${hasActualCost ? 'text-yellow-400' : 'text-gray-600'}`}>
            {hasActualCost ? `$${stats.totalActualUsd.toFixed(4)}` : '–'}
          </div>
          <div className="text-[10px] text-gray-600 uppercase tracking-wide mt-0.5">Ausgaben</div>
        </div>

        {/* Completed */}
        <div className="text-center">
          <div className={`text-xl font-bold ${stats.completed > 0 ? 'text-green-400/70' : 'text-gray-600'}`}>
            {stats.completed}
          </div>
          <div className="text-[10px] text-gray-600 uppercase tracking-wide mt-0.5">Fertig</div>
        </div>
      </div>

      {/* Pending chip */}
      {stats.pending > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-800 flex items-center gap-2">
          <Link
            href="/delegations?status=pending"
            className="text-xs text-yellow-500/80 hover:text-yellow-400 transition-colors"
          >
            {stats.pending} ausstehend →
          </Link>
          {stats.failed > 0 && (
            <span className="text-xs text-red-500/70 ml-2">
              {stats.failed} fehlgeschlagen
            </span>
          )}
        </div>
      )}
    </div>
  )
}
