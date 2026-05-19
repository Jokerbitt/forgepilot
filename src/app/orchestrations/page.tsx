'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type { OrchestratedRun, OrchestratedTaskEntry } from '@/lib/agents/orchestrated-run'
import { cx } from '@/components/ui/primitives'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  planning: 'bg-slate-800 text-slate-400 border-slate-700',
  running:  'bg-violet-900/50 text-violet-300 border-violet-700',
  done:     'bg-emerald-900/40 text-emerald-300 border-emerald-800',
  failed:   'bg-red-900/40 text-red-300 border-red-800',
  aborted:  'bg-slate-900 text-slate-500 border-slate-800',
}

const TASK_STATUS_ICON: Record<string, string> = {
  pending:  '○',
  assigned: '◎',
  running:  '▶',
  done:     '✓',
  failed:   '✗',
  skipped:  '–',
}

const TASK_STATUS_COLOR: Record<string, string> = {
  pending:  'text-slate-500',
  assigned: 'text-blue-400',
  running:  'text-violet-400',
  done:     'text-emerald-400',
  failed:   'text-red-400',
  skipped:  'text-slate-600',
}

function gradeColor(score: number): string {
  if (score >= 90) return 'text-emerald-400'
  if (score >= 75) return 'text-sky-400'
  if (score >= 60) return 'text-amber-400'
  return 'text-red-400'
}

// ─── Task row ────────────────────────────────────────────────────────────────

function TaskRow({ entry, runId, onRetry }: {
  entry: OrchestratedTaskEntry
  runId: string
  onRetry: (taskId: string) => void
}) {
  const isFailed = entry.status === 'failed'
  const isDone   = entry.status === 'done'
  const isRunning = entry.status === 'running'

  return (
    <div className={cx(
      'flex items-start gap-3 rounded-lg border px-3 py-2 transition-colors',
      isDone    ? 'border-emerald-900/30 bg-emerald-950/10' :
      isFailed  ? 'border-red-900/30 bg-red-950/10' :
      isRunning ? 'border-violet-800/40 bg-violet-950/20' :
      'border-slate-800/50 bg-transparent',
    )}>
      {/* Status icon */}
      <span className={cx('mt-0.5 shrink-0 w-4 text-center text-xs font-bold', TASK_STATUS_COLOR[entry.status])}>
        {isRunning
          ? <span className="inline-block h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
          : TASK_STATUS_ICON[entry.status]}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-slate-200 truncate">{entry.task.title}</p>
          <span className="shrink-0 rounded-full bg-slate-800 px-1.5 py-0.5 text-xs text-slate-500 capitalize">
            {entry.task.skillCategory.replace(/-/g, ' ')}
          </span>
        </div>
        {entry.result && (
          <div className="mt-1 flex items-center gap-2 text-xs">
            <span className={cx('font-bold tabular-nums', gradeColor(entry.result.qualityScore))}>
              {entry.result.qualityScore}pts
            </span>
            <span className="text-slate-600">Grade {entry.result.grade}</span>
            {entry.result.issues.length > 0 && (
              <span className="text-red-400 truncate">{entry.result.issues[0]}</span>
            )}
          </div>
        )}
      </div>

      {/* Right side: agent + retry */}
      <div className="shrink-0 flex flex-col items-end gap-1">
        <span className="text-xs text-violet-400/70">{entry.agentType}</span>
        {entry.retryCount > 0 && (
          <span className="text-xs text-amber-500">↺ {entry.retryCount}x</span>
        )}
        {isFailed && (
          <button
            onClick={() => onRetry(entry.task.id)}
            className="rounded px-1.5 py-0.5 text-xs text-amber-400 border border-amber-800/40 hover:bg-amber-950/30 transition-colors"
          >
            ↺ Retry
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Run card ────────────────────────────────────────────────────────────────

function RunCard({ run: initialRun }: { run: OrchestratedRun }) {
  const [run, setRun] = useState(initialRun)
  const [expanded, setExpanded] = useState(false)
  const [executing, setExecuting] = useState(false)

  // Auto-poll when running
  useEffect(() => {
    if (run.status !== 'running') return
    const iv = setInterval(async () => {
      const res = await fetch(`/api/agents/orchestrate/${run.id}`)
      if (!res.ok) return
      const updated = await res.json() as OrchestratedRun
      setRun(updated)
      if (updated.status !== 'running') clearInterval(iv)
    }, 3000)
    return () => clearInterval(iv)
  }, [run.id, run.status])

  const handleExecute = async () => {
    setExecuting(true)
    await fetch(`/api/agents/orchestrate/${run.id}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    // Optimistically flip to running
    setRun(r => ({ ...r, status: 'running' }))
    setExecuting(false)
  }

  const handleRetry = async (taskId: string) => {
    await fetch(`/api/agents/orchestrate/${run.id}/tasks/${taskId}/retry`, { method: 'POST' })
    const res = await fetch(`/api/agents/orchestrate/${run.id}`)
    setRun(await res.json() as OrchestratedRun)
  }

  const done  = run.tasks.filter(t => t.status === 'done').length
  const total = run.tasks.length
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer hover:bg-slate-800/30 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Status badge */}
        <span className={cx('mt-0.5 shrink-0 rounded border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide', STATUS_COLOR[run.status])}>
          {run.status === 'running' && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />}
          {run.status}
        </span>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{run.delegationTitle || run.goal.slice(0, 60)}</p>
          <p className="mt-0.5 text-xs text-slate-500 truncate">{run.goal.slice(0, 100)}</p>
          <div className="mt-2 flex items-center gap-3">
            {/* Progress bar */}
            <div className="flex-1 max-w-32 h-1 rounded-full bg-slate-800">
              <div
                className={cx('h-1 rounded-full transition-all', run.status === 'done' ? 'bg-emerald-500' : 'bg-violet-500')}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-slate-500">{done}/{total} Tasks</span>
            {run.overallQualityScore !== undefined && (
              <span className={cx('text-xs font-bold tabular-nums', gradeColor(run.overallQualityScore))}>
                {run.overallQualityScore}pts
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="shrink-0 flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {(run.status === 'planning' || run.status === 'failed') && (
            <button
              onClick={handleExecute}
              disabled={executing}
              className="rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-600 disabled:opacity-40 transition-colors"
            >
              {executing ? 'Startet…' : '▶ Ausführen'}
            </button>
          )}
          <Link
            href={`/delegations/${run.delegationId}`}
            className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
          >
            Delegation →
          </Link>
          <span className="text-xs text-slate-600">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Expandable task list */}
      {expanded && (
        <div className="border-t border-slate-800 p-4 space-y-1.5">
          {run.tasks.map(entry => (
            <TaskRow
              key={entry.task.id}
              entry={entry}
              runId={run.id}
              onRetry={handleRetry}
            />
          ))}
          <p className="mt-2 text-xs text-slate-600">
            Max. {run.maxRetries} Retries pro Task · Erstellt {new Date(run.createdAt).toLocaleString('de-DE')}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── New Run Form ─────────────────────────────────────────────────────────────

function NewRunForm({ onCreated }: { onCreated: (run: OrchestratedRun) => void }) {
  const [goal, setGoal] = useState('')
  const [context, setContext] = useState('')
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!goal.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/agents/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, context, delegationId: `manual-${Date.now()}`, delegationTitle: goal }),
      })
      const { run } = await res.json() as { run: OrchestratedRun }
      onCreated(run)
      setGoal('')
      setContext('')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="rounded-xl border border-violet-800/30 bg-violet-950/10 p-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-violet-400">Neuen Orchestrated Run starten</p>
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Goal *</label>
          <input
            value={goal}
            onChange={e => setGoal(e.target.value)}
            placeholder="z.B. Add pagination to the delegation list API"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-violet-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Context (optional)</label>
          <textarea
            value={context}
            onChange={e => setContext(e.target.value)}
            rows={2}
            placeholder="Zusätzlicher Kontext für den AI-Decomposer…"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-violet-500 focus:outline-none resize-none"
          />
        </div>
        <button
          onClick={handleCreate}
          disabled={creating || !goal.trim()}
          className="w-full rounded-lg bg-violet-700 py-2 text-sm font-semibold text-white hover:bg-violet-600 disabled:opacity-40 transition-colors"
        >
          {creating ? '⚙ Zerlege mit AI…' : '⚙ Orchestrieren'}
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrchestrationsPage() {
  const [runs, setRuns] = useState<OrchestratedRun[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  const load = useCallback(async () => {
    const res = await fetch('/api/agents/orchestrate')
    const { runs: fetched } = await res.json() as { runs: OrchestratedRun[] }
    setRuns(fetched ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const filters = ['all', 'running', 'planning', 'done', 'failed'] as const
  const visible = filter === 'all' ? runs : runs.filter(r => r.status === filter)

  const activeCount = runs.filter(r => r.status === 'running').length
  const doneCount   = runs.filter(r => r.status === 'done').length
  const avgQuality  = runs.filter(r => r.overallQualityScore !== undefined).length > 0
    ? Math.round(runs.filter(r => r.overallQualityScore !== undefined)
        .reduce((a, r) => a + r.overallQualityScore!, 0) /
        runs.filter(r => r.overallQualityScore !== undefined).length)
    : null

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">Orchestrierungen</h1>
              <p className="mt-1 text-sm text-slate-500">
                AI-dekomponierten Runs verwalten · Qualität verfolgen · Drift reduzieren
              </p>
            </div>
            {activeCount > 0 && (
              <div className="flex items-center gap-1.5 rounded-full border border-violet-700/40 bg-violet-950/40 px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
                <span className="text-xs font-medium text-violet-300">{activeCount} aktiv</span>
              </div>
            )}
          </div>

          {/* KPI strip */}
          {runs.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2.5">
                <p className="text-xs text-slate-500">Runs gesamt</p>
                <p className="mt-0.5 text-xl font-bold tabular-nums text-white">{runs.length}</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2.5">
                <p className="text-xs text-slate-500">Aktiv</p>
                <p className={cx('mt-0.5 text-xl font-bold tabular-nums', activeCount > 0 ? 'text-violet-400' : 'text-slate-500')}>{activeCount}</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2.5">
                <p className="text-xs text-slate-500">Abgeschlossen</p>
                <p className="mt-0.5 text-xl font-bold tabular-nums text-emerald-400">{doneCount}</p>
              </div>
              {avgQuality !== null && (
                <div className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2.5">
                  <p className="text-xs text-slate-500">Ø Qualität</p>
                  <p className={cx('mt-0.5 text-xl font-bold tabular-nums', gradeColor(avgQuality))}>{avgQuality}pts</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* New run form */}
        <div className="mb-6">
          <NewRunForm onCreated={run => setRuns(prev => [run, ...prev])} />
        </div>

        {/* Filter tabs */}
        {runs.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {filters.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cx(
                  'rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors',
                  filter === f
                    ? 'bg-violet-700 text-white'
                    : 'border border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300',
                )}
              >
                {f === 'all' ? `Alle (${runs.length})` : `${f} (${runs.filter(r => r.status === f).length})`}
              </button>
            ))}
          </div>
        )}

        {/* Run list */}
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500">Lade Runs…</p>
        ) : visible.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-12 text-center">
            <p className="text-sm font-medium text-white">
              {runs.length === 0 ? 'Noch keine Orchestrierungen' : 'Keine Runs in dieser Kategorie'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {runs.length === 0
                ? 'Starte eine neue Orchestrierung oben oder über einen Delegations-Auftrag.'
                : 'Wähle einen anderen Filter.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map(run => <RunCard key={run.id} run={run} />)}
          </div>
        )}
      </div>
    </div>
  )
}
