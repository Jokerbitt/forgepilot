'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { AgentRun } from '@/lib/models/agent-run'
import { Badge, EmptyState, StatusDot, cx } from '@/components/ui/primitives'
import { AgentModeBanner } from '@/components/ui/AgentModeBanner'

function statusTone(status: AgentRun['status']): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'completed') return 'success'
  if (status === 'running') return 'warning'
  if (status === 'failed') return 'danger'
  return 'neutral'
}

function statusLabel(status: AgentRun['status']): string {
  if (status === 'queued') return 'Warteschlange'
  if (status === 'running') return 'Läuft'
  if (status === 'completed') return 'Abgeschlossen'
  if (status === 'failed') return 'Fehlgeschlagen'
  if (status === 'cancelled') return 'Abgebrochen'
  return status
}

function formatCost(usd: number): string {
  if (usd === 0) return '—'
  if (usd < 0.01) return `$${(usd * 100).toFixed(2)}¢`
  return `$${usd.toFixed(4)}`
}

function formatDuration(run: AgentRun): string {
  if (!run.completedAt) return run.status === 'running' ? 'Läuft…' : '—'
  const ms = new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function AgentRunsPage() {
  const [runs, setRuns] = useState<AgentRun[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/agent-runs')
      .then(r => r.json())
      .then((data: AgentRun[]) => {
        setRuns(Array.isArray(data) ? data.slice().reverse() : [])
      })
      .catch(() => setRuns([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl p-6">
        <header className="mb-8 mt-2 border-b border-slate-800 pb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Execute</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Agent Runs</h1>
          <p className="mt-2 text-sm text-slate-400">Alle Agenten-Ausführungen, Trace-Events und Kosten.</p>
        </header>

        <div className="mb-6">
          <AgentModeBanner />
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Lade Agent Runs…</p>
        ) : runs.length === 0 ? (
          <EmptyState
            title="Noch keine Agent Runs"
            description="Starte eine Delegation und weise sie einem Agenten zu."
            action={<Link href="/delegations" className="text-sm font-medium text-sky-400 hover:underline">Zur Delegation Queue</Link>}
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Modell</th>
                  <th className="hidden px-4 py-3 sm:table-cell">Tokens</th>
                  <th className="hidden px-4 py-3 sm:table-cell">Kosten</th>
                  <th className="hidden px-4 py-3 md:table-cell">Dauer</th>
                  <th className="px-4 py-3">Gestartet</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {runs.map(run => (
                  <tr key={run.id} className="group hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StatusDot tone={statusTone(run.status)} />
                        <span className={cx(
                          'text-xs font-medium',
                          run.status === 'completed' ? 'text-emerald-400' :
                          run.status === 'running' ? 'text-amber-300' :
                          run.status === 'failed' ? 'text-red-400' : 'text-slate-400'
                        )}>
                          {statusLabel(run.status)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-300">{run.model}</td>
                    <td className="hidden px-4 py-3 text-slate-400 sm:table-cell">
                      {run.tokenInput + run.tokenOutput > 0
                        ? `${(run.tokenInput + run.tokenOutput).toLocaleString()}`
                        : '—'}
                    </td>
                    <td className="hidden px-4 py-3 text-slate-400 sm:table-cell">
                      {formatCost(run.totalCostUsd)}
                    </td>
                    <td className="hidden px-4 py-3 text-slate-400 md:table-cell">{formatDuration(run)}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(run.startedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/agent-runs/${run.id}`}
                        className="rounded px-2 py-1 text-xs text-sky-400 opacity-0 ring-1 ring-sky-500/30 transition hover:bg-sky-500/10 group-hover:opacity-100"
                      >
                        Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 flex items-center gap-4 text-xs text-slate-600">
          <span>{runs.length} Run{runs.length !== 1 ? 's' : ''}</span>
          {runs.length > 0 && (
            <>
              <span>·</span>
              <span>
                Gesamt: {formatCost(runs.reduce((s, r) => s + r.totalCostUsd, 0))}
              </span>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
