'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import type { AgentRun, TraceEvent } from '@/lib/models/agent-run'
import { Badge, StatusDot, cx } from '@/components/ui/primitives'

function statusLabel(status: AgentRun['status']): string {
  if (status === 'queued') return 'Warteschlange'
  if (status === 'running') return 'Läuft'
  if (status === 'completed') return 'Abgeschlossen'
  if (status === 'failed') return 'Fehlgeschlagen'
  if (status === 'cancelled') return 'Abgebrochen'
  return status
}

function statusTone(status: AgentRun['status']): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'completed') return 'success'
  if (status === 'running') return 'warning'
  if (status === 'failed') return 'danger'
  return 'neutral'
}

function formatCost(usd: number): string {
  if (usd === 0) return '—'
  if (usd < 0.01) return `$${(usd * 100).toFixed(4)}¢`
  return `$${usd.toFixed(4)}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function traceEventLabel(type: TraceEvent['type']): string {
  if (type === 'tool_call') return 'Tool Call'
  if (type === 'tool_result') return 'Tool Result'
  if (type === 'message') return 'Message'
  if (type === 'error') return 'Error'
  if (type === 'cost_update') return 'Cost Update'
  if (type === 'status_change') return 'Status'
  return type
}

function traceEventTone(type: TraceEvent['type']): string {
  if (type === 'error') return 'text-red-400 bg-red-900/20 border-red-800/50'
  if (type === 'tool_call') return 'text-sky-300 bg-sky-900/20 border-sky-800/50'
  if (type === 'tool_result') return 'text-emerald-300 bg-emerald-900/20 border-emerald-800/50'
  if (type === 'cost_update') return 'text-amber-300 bg-amber-900/20 border-amber-800/50'
  return 'text-slate-400 bg-slate-900/50 border-slate-800'
}

export default function AgentRunDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [run, setRun] = useState<AgentRun | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return
    fetch(`/api/agent-runs/${id}`)
      .then(r => {
        if (r.status === 404) { setNotFound(true); return null }
        return r.json() as Promise<AgentRun>
      })
      .then(data => { if (data) setRun(data) })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <p className="text-sm text-slate-500">Lade Agent Run…</p>
    </main>
  )

  if (notFound || !run) return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <Link href="/agent-runs" className="mb-4 inline-flex items-center gap-1 text-xs text-sky-400 hover:underline">
        ← Agent Runs
      </Link>
      <p className="mt-4 text-sm text-slate-500">Agent Run nicht gefunden.</p>
    </main>
  )

  const duration = run.completedAt
    ? `${Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)}s`
    : null

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-4xl p-6">
        <div className="mb-6">
          <Link href="/agent-runs" className="inline-flex items-center gap-1 text-xs text-sky-400 hover:underline">
            ← Agent Runs
          </Link>
        </div>

        <header className="mb-8 border-b border-slate-800 pb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Execute / Agent Run</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">Run Detail</h1>
              <p className="mt-1 font-mono text-xs text-slate-600">{run.id}</p>
            </div>
            <div className="flex items-center gap-2">
              <StatusDot tone={statusTone(run.status)} />
              <span className={cx(
                'text-sm font-semibold',
                run.status === 'completed' ? 'text-emerald-400' :
                run.status === 'running' ? 'text-amber-300' :
                run.status === 'failed' ? 'text-red-400' : 'text-slate-400'
              )}>
                {statusLabel(run.status)}
              </span>
            </div>
          </div>
        </header>

        {/* Metrics */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Modell', value: run.model },
            { label: 'Kosten', value: formatCost(run.totalCostUsd) },
            { label: 'Tokens In', value: run.tokenInput > 0 ? run.tokenInput.toLocaleString() : '—' },
            { label: 'Tokens Out', value: run.tokenOutput > 0 ? run.tokenOutput.toLocaleString() : '—' },
          ].map(m => (
            <div key={m.label} className="rounded-lg border border-slate-800 bg-slate-900 p-3">
              <p className="text-xs text-slate-500">{m.label}</p>
              <p className="mt-1 font-mono text-sm font-medium text-white">{m.value}</p>
            </div>
          ))}
        </div>

        {/* Timestamps */}
        <div className="mb-6 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3">
          <div className="flex flex-wrap gap-x-8 gap-y-1 text-xs">
            <div>
              <span className="text-slate-500">Gestartet: </span>
              <span className="text-slate-300">{formatDate(run.startedAt)}</span>
            </div>
            {run.completedAt && (
              <div>
                <span className="text-slate-500">Abgeschlossen: </span>
                <span className="text-slate-300">{formatDate(run.completedAt)}</span>
              </div>
            )}
            {duration && (
              <div>
                <span className="text-slate-500">Dauer: </span>
                <span className="text-slate-300">{duration}</span>
              </div>
            )}
          </div>
        </div>

        {/* Result Summary */}
        {run.resultSummary && (
          <section className="mb-6">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Run Summary</h2>
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
              <pre className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{run.resultSummary}</pre>
            </div>
          </section>
        )}

        {/* Error */}
        {run.errorMessage && (
          <section className="mb-6">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-red-500">Fehlermeldung</h2>
            <div className="rounded-lg border border-red-800/40 bg-red-900/10 p-4">
              <pre className="whitespace-pre-wrap text-sm text-red-300">{run.errorMessage}</pre>
            </div>
          </section>
        )}

        {/* PR Link */}
        {run.prUrl && (
          <div className="mb-6">
            <a
              href={run.prUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-sky-400 hover:underline"
            >
              Pull Request ansehen →
            </a>
          </div>
        )}

        {/* Trace Events */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Trace Events ({run.traceEvents.length})
          </h2>
          {run.traceEvents.length === 0 ? (
            <p className="text-sm text-slate-600">Noch keine Trace Events aufgezeichnet.</p>
          ) : (
            <div className="space-y-2">
              {run.traceEvents.map((ev, i) => (
                <div
                  key={ev.id}
                  className={cx('rounded-lg border p-3 text-xs', traceEventTone(ev.type))}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-600">#{i + 1}</span>
                      <span className="font-semibold">{traceEventLabel(ev.type)}</span>
                      {ev.costUsd && ev.costUsd > 0 && (
                        <Badge>{formatCost(ev.costUsd)}</Badge>
                      )}
                    </div>
                    <span className="shrink-0 font-mono text-slate-600">{formatDate(ev.timestamp)}</span>
                  </div>
                  {Object.keys(ev.data).length > 0 && (
                    <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed opacity-70">
                      {JSON.stringify(ev.data, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
