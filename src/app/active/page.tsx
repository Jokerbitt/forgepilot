'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type { Delegation } from '@/lib/models/delegation'
import { ElapsedTimer } from '@/components/shared/ElapsedTimer'

const RISK_COLORS: Record<string, string> = {
  A: 'text-emerald-400 border-emerald-800/50 bg-emerald-950/20',
  B: 'text-amber-400 border-amber-800/50 bg-amber-950/20',
  C: 'text-red-400 border-red-800/50 bg-red-950/20',
}

export default function ActiveRunsPage() {
  const [delegations, setDelegations] = useState<Delegation[]>([])
  const [loading, setLoading] = useState(true)
  const [stoppingId, setStoppingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/delegations')
    const all = await res.json() as Delegation[]
    setDelegations(all)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 3000)
    return () => clearInterval(interval)
  }, [load])

  const handleStop = async (id: string) => {
    setStoppingId(id)
    await fetch(`/api/delegations/${id}/cancel`, { method: 'POST' })
    await load()
    setStoppingId(null)
  }

  const running = delegations.filter(d => d.status === 'running')
  const approved = delegations.filter(d => d.status === 'approved')
  const recentDone = delegations
    .filter(d => d.status === 'completed' || d.status === 'failed')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5)

  const totalEstimatedCost = running.reduce((sum, d) => sum + (d.costEstimateUsd ?? 0), 0)
  const totalActualCost = delegations
    .filter(d => d.actualCostUsd != null)
    .reduce((sum, d) => sum + (d.actualCostUsd ?? 0), 0)

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white p-6">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="h-8 w-48 animate-pulse rounded bg-slate-800" />
          <div className="h-32 animate-pulse rounded-xl border border-slate-800 bg-slate-900" />
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Active Runs</h1>
            <p className="mt-1 text-sm text-slate-500">
              {running.length} Agent{running.length !== 1 ? 'en' : ''} aktiv
              {approved.length > 0 && ` · ${approved.length} bereit zum Start`}
            </p>
          </div>
          <Link href="/delegations" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
            Alle Delegationen →
          </Link>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Aktiv</p>
            <p className="mt-1 text-3xl font-bold text-white">{running.length}</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Laufende Kosten</p>
            <p className="mt-1 text-3xl font-bold text-amber-400">
              ${totalEstimatedCost.toFixed(2)}
            </p>
            <p className="mt-0.5 text-xs text-slate-600">geschätzt</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Gesamt (heute)</p>
            <p className="mt-1 text-3xl font-bold text-emerald-400">
              ${totalActualCost.toFixed(3)}
            </p>
            <p className="mt-0.5 text-xs text-slate-600">tatsächlich</p>
          </div>
        </div>

        {/* Running agents */}
        {running.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-12 text-center">
            <p className="text-4xl mb-3">💤</p>
            <p className="text-slate-400 font-medium">Keine laufenden Agents</p>
            <p className="mt-1 text-sm text-slate-600">
              {approved.length > 0
                ? `${approved.length} Delegation${approved.length > 1 ? 'en' : ''} bereit zum Start`
                : 'Erstelle eine neue Delegation um einen Agenten zu starten'}
            </p>
            {approved.length > 0 && (
              <Link href="/delegations" className="mt-4 inline-block text-sm text-blue-400 hover:text-blue-300 transition-colors">
                Zur Delegation Queue →
              </Link>
            )}
          </div>
        ) : (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Laufende Agents</h2>
            {running.map(d => <RunCard key={d.id} delegation={d} onStop={handleStop} stopping={stoppingId === d.id} />)}
          </section>
        )}

        {/* Ready to start */}
        {approved.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bereit zum Start</h2>
            {approved.map(d => <RunCard key={d.id} delegation={d} onStop={handleStop} stopping={false} />)}
          </section>
        )}

        {/* Recently finished */}
        {recentDone.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Zuletzt abgeschlossen</h2>
            {recentDone.map(d => <RunCard key={d.id} delegation={d} onStop={handleStop} stopping={false} />)}
          </section>
        )}

      </div>
    </main>
  )
}

function RunCard({ delegation: d, onStop, stopping }: {
  delegation: Delegation
  onStop: (id: string) => void
  stopping: boolean
}) {
  const lastLog = (d.logs ?? []).at(-1)
  const budgetPct = d.contract.maxBudgetUsd > 0
    ? Math.min(100, Math.round(((d.actualCostUsd ?? d.costEstimateUsd ?? 0) / d.contract.maxBudgetUsd) * 100))
    : 0

  return (
    <div className={`rounded-xl border p-4 transition-colors ${
      d.status === 'running' ? 'border-amber-800/40 bg-amber-950/10'
      : d.status === 'completed' ? 'border-emerald-800/30 bg-emerald-950/10'
      : d.status === 'failed' ? 'border-red-800/30 bg-red-950/10'
      : 'border-slate-800 bg-slate-900/30'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${RISK_COLORS[d.contract.riskClass] ?? ''}`}>
              Risk {d.contract.riskClass}
            </span>
            <span className="font-mono text-[10px] text-slate-600">{d.contract.workItemId}</span>
            {d.status === 'running' && (
              <ElapsedTimer startedAt={d.updatedAt || d.createdAt} className="text-xs text-amber-400 font-mono" />
            )}
          </div>
          <Link href={`/delegations/${d.id}`} className="text-sm font-medium text-white hover:text-slate-300 transition-colors">
            {d.title || d.contract.goal.slice(0, 80)}
          </Link>
          {lastLog && (
            <p className="mt-1 truncate text-xs text-slate-500">{lastLog.message}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Budget bar */}
          {d.contract.maxBudgetUsd > 0 && (
            <div className="hidden sm:flex items-center gap-1.5">
              <div className="h-1 w-16 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full ${budgetPct >= 90 ? 'bg-red-500' : budgetPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${budgetPct}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-500">
                ${(d.actualCostUsd ?? d.costEstimateUsd ?? 0).toFixed(2)}
              </span>
            </div>
          )}

          {d.status === 'running' && (
            <button
              onClick={() => onStop(d.id)}
              disabled={stopping}
              className="rounded border border-red-800/50 bg-red-950/20 px-2 py-1 text-xs text-red-400 hover:border-red-600 transition-colors disabled:opacity-50"
            >
              {stopping ? '…' : '⏹'}
            </button>
          )}

          <Link
            href={`/delegations/${d.id}`}
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:border-slate-500 transition-colors"
          >
            Detail →
          </Link>
        </div>
      </div>
    </div>
  )
}
