'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type { Delegation, DelegationStatus } from '@/lib/models/delegation'
import { ElapsedTimer } from '@/components/shared/ElapsedTimer'
import { detectConflicts, conflictingIds, type ConflictWarning } from '@/lib/board/conflicts'

const RISK_COLORS: Record<string, string> = {
  A: 'text-emerald-400 border-emerald-800/50 bg-emerald-950/20',
  B: 'text-amber-400 border-amber-800/50 bg-amber-950/20',
  C: 'text-red-400 border-red-800/50 bg-red-950/20',
}

const AGENT_AVATAR: Record<string, { label: string; color: string }> = {
  'runner':       { label: 'CC', color: 'bg-sky-900/60 border-sky-700/50 text-sky-300' },
  'local-agent':  { label: 'LA', color: 'bg-violet-900/60 border-violet-700/50 text-violet-300' },
  'direct-chat':  { label: 'DC', color: 'bg-slate-800 border-slate-700 text-slate-400' },
  'n8n':          { label: 'N8', color: 'bg-orange-900/60 border-orange-700/50 text-orange-300' },
  'manual':       { label: '👤', color: 'bg-slate-800 border-slate-700 text-slate-400' },
}

type Column = {
  id: DelegationStatus | 'done'
  label: string
  statuses: DelegationStatus[]
  accent: string
  headerDot: string
}

const COLUMNS: Column[] = [
  { id: 'pending',  label: 'Ausstehend', statuses: ['pending'],   accent: 'border-slate-700', headerDot: 'bg-slate-500' },
  { id: 'approved', label: 'Freigegeben', statuses: ['approved'], accent: 'border-blue-800/40', headerDot: 'bg-blue-400' },
  { id: 'running',  label: 'Läuft',       statuses: ['running'],  accent: 'border-amber-700/40', headerDot: 'bg-amber-400 animate-pulse' },
  { id: 'done',     label: 'Fertig',      statuses: ['completed', 'failed', 'cancelled'], accent: 'border-slate-700', headerDot: 'bg-slate-600' },
]

export default function BoardPage() {
  const [delegations, setDelegations] = useState<Delegation[]>([])
  const [loading, setLoading] = useState(true)
  const [stoppingId, setStoppingId] = useState<string | null>(null)
  const [conflicts, setConflicts] = useState<ConflictWarning[]>([])
  const [conflicted, setConflicted] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    const res = await fetch('/api/delegations')
    const all = await res.json() as Delegation[]
    setDelegations(all)
    const w = detectConflicts(all)
    setConflicts(w)
    setConflicted(conflictingIds(w))
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 4000)
    return () => clearInterval(interval)
  }, [load])

  const handleStop = async (id: string) => {
    setStoppingId(id)
    await fetch(`/api/delegations/${id}/cancel`, { method: 'POST' })
    await load()
    setStoppingId(null)
  }

  const recentDone = delegations
    .filter(d => ['completed', 'failed', 'cancelled'].includes(d.status))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 8)

  const getColumnDelegations = (col: Column): Delegation[] => {
    if (col.id === 'done') return recentDone
    return delegations.filter(d => col.statuses.includes(d.status))
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white p-6">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="h-8 w-48 animate-pulse rounded bg-slate-800" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-64 animate-pulse rounded-xl border border-slate-800 bg-slate-900" />
            ))}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Agent Board</h1>
            <p className="mt-1 text-sm text-slate-500">
              {delegations.filter(d => d.status === 'running').length} Agent{delegations.filter(d => d.status === 'running').length !== 1 ? 'en' : ''} aktiv
            </p>
          </div>
          <Link
            href="/delegations"
            className="rounded border border-sky-800/50 bg-sky-950/20 px-3 py-1.5 text-sm text-sky-400 hover:border-sky-600 transition-colors"
          >
            + Neue Delegation
          </Link>
        </div>

        {/* Conflict warnings */}
        {conflicts.length > 0 && (
          <div className="rounded-lg border border-red-800/40 bg-red-950/10 p-3 space-y-1">
            <p className="text-xs font-semibold text-red-400">⚠️ {conflicts.length} Konflikt{conflicts.length > 1 ? 'e' : ''} erkannt</p>
            {conflicts.map((w, i) => (
              <p key={i} className="text-xs text-red-300/70">{w.reason} — {w.delegationIds.length} aktive Delegationen</p>
            ))}
          </div>
        )}

        {/* Kanban board */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map(col => {
            const items = getColumnDelegations(col)
            return (
              <div key={col.id} className={`rounded-xl border ${col.accent} bg-slate-900/30`}>
                {/* Column header */}
                <div className="flex items-center justify-between border-b border-slate-800/60 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${col.headerDot}`} />
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{col.label}</span>
                  </div>
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-500">
                    {items.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="space-y-2 p-3 min-h-[120px]">
                  {items.length === 0 ? (
                    <p className="py-6 text-center text-xs text-slate-700">Leer</p>
                  ) : (
                    items.map(d => (
                      <KanbanCard
                        key={d.id}
                        delegation={d}
                        onStop={handleStop}
                        stopping={stoppingId === d.id}
                        hasConflict={conflicted.has(d.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>

      </div>
    </main>
  )
}

function KanbanCard({
  delegation: d,
  onStop,
  stopping,
  hasConflict,
}: {
  delegation: Delegation
  onStop: (id: string) => void
  stopping: boolean
  hasConflict: boolean
}) {
  const avatar = AGENT_AVATAR[d.executionRoute] ?? AGENT_AVATAR['manual']
  const budgetPct = d.contract.maxBudgetUsd > 0
    ? Math.min(100, Math.round(((d.actualCostUsd ?? d.costEstimateUsd ?? 0) / d.contract.maxBudgetUsd) * 100))
    : 0
  const label = d.title || d.contract.goal.slice(0, 60)

  return (
    <div className={`rounded-lg border p-3 transition-colors ${
      hasConflict
        ? 'border-red-800/50 bg-red-950/10'
        : d.status === 'running'
          ? 'border-amber-800/30 bg-amber-950/5'
          : d.status === 'completed'
            ? 'border-emerald-800/20 bg-slate-900/30'
            : d.status === 'failed'
              ? 'border-red-800/20 bg-slate-900/30'
              : 'border-slate-800/60 bg-slate-900/20'
    }`}>

      {/* Top row: risk badge + agent avatar + conflict */}
      <div className="mb-2 flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5">
          <span className={`rounded border px-1 py-0.5 text-[10px] font-medium ${RISK_COLORS[d.contract.riskClass] ?? ''}`}>
            {d.contract.riskClass}
          </span>
          {hasConflict && (
            <span className="text-[10px] text-red-400" title="Konflikt erkannt">⚠️</span>
          )}
        </div>
        <div className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[9px] font-bold ${avatar.color}`}>
          {avatar.label}
        </div>
      </div>

      {/* Title */}
      <Link
        href={`/delegations/${d.id}`}
        className="block text-xs font-medium text-white hover:text-slate-300 transition-colors leading-snug"
      >
        {label.length > 70 ? label.slice(0, 70) + '…' : label}
      </Link>

      {/* Work item ID */}
      <p className="mt-1 font-mono text-[10px] text-slate-600">{d.contract.workItemId}</p>

      {/* Running: timer + stop */}
      {d.status === 'running' && (
        <div className="mt-2 flex items-center justify-between">
          <ElapsedTimer startedAt={d.updatedAt || d.createdAt} className="text-[10px] text-amber-400 font-mono" />
          <button
            onClick={() => onStop(d.id)}
            disabled={stopping}
            className="rounded border border-red-800/40 bg-red-950/10 px-1.5 py-0.5 text-[10px] text-red-400 hover:border-red-600 transition-colors disabled:opacity-50"
          >
            {stopping ? '…' : '⏹'}
          </button>
        </div>
      )}

      {/* Budget bar */}
      {d.contract.maxBudgetUsd > 0 && (
        <div className="mt-2 flex items-center gap-1.5">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full rounded-full ${budgetPct >= 90 ? 'bg-red-500' : budgetPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${budgetPct}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-600">
            ${(d.actualCostUsd ?? d.costEstimateUsd ?? 0).toFixed(2)}
          </span>
        </div>
      )}
    </div>
  )
}
