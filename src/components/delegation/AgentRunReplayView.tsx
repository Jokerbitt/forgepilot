'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AgentRun, TraceEvent, TraceEventType } from '@/lib/models/agent-run'

interface Props {
  delegationId: string
}

// ─── Event type metadata ────────────────────────────────────────────────────

const EVENT_META: Record<TraceEventType, { label: string; color: string; icon: string }> = {
  tool_call:     { label: 'Tool Call',     color: 'text-violet-400', icon: '🔧' },
  tool_result:   { label: 'Tool Result',   color: 'text-emerald-400', icon: '✅' },
  message:       { label: 'Message',       color: 'text-sky-400', icon: '💬' },
  error:         { label: 'Fehler',        color: 'text-red-400', icon: '❌' },
  cost_update:   { label: 'Kosten',        color: 'text-amber-400', icon: '💰' },
  status_change: { label: 'Status',        color: 'text-slate-400', icon: '🔄' },
}

const STATUS_STYLES: Record<string, string> = {
  queued:    'border-slate-700 bg-slate-900 text-slate-400',
  running:   'border-emerald-700/60 bg-emerald-950/40 text-emerald-300',
  completed: 'border-sky-700/60 bg-sky-950/40 text-sky-300',
  failed:    'border-red-700/60 bg-red-950/40 text-red-300',
  cancelled: 'border-slate-700 bg-slate-900 text-slate-500',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTs(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch { return iso }
}

function fmtCost(usd: number): string {
  return usd < 0.01 ? `$${(usd * 100).toFixed(3)}¢` : `$${usd.toFixed(4)}`
}

function eventSummary(ev: TraceEvent): string {
  const d = ev.data
  if (ev.type === 'tool_call')     return `${String(d.toolName ?? d.name ?? 'unknown')}(${String(d.input ?? '').slice(0, 80)})`
  if (ev.type === 'tool_result')   return String(d.output ?? d.result ?? '').slice(0, 120)
  if (ev.type === 'message')       return String(d.text ?? d.content ?? '').slice(0, 120)
  if (ev.type === 'error')         return String(d.message ?? d.error ?? 'Unknown error')
  if (ev.type === 'cost_update')   return `+${d.inputTokens ?? 0} in / ${d.outputTokens ?? 0} out${ev.costUsd ? ` / ${fmtCost(ev.costUsd)}` : ''}`
  if (ev.type === 'status_change') return `→ ${String(d.status ?? '')}`
  return JSON.stringify(d).slice(0, 100)
}

// ─── Sub-component: single event card ────────────────────────────────────────

function EventCard({ ev, index, highlight }: { ev: TraceEvent; index: number; highlight: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const meta = EVENT_META[ev.type] ?? { label: ev.type, color: 'text-slate-400', icon: '•' }

  return (
    <div className={`rounded-lg border px-3 py-2 transition-colors ${highlight ? 'border-violet-600/60 bg-violet-950/30' : 'border-slate-800 bg-slate-900/40'}`}>
      <div className="flex items-start gap-2.5">
        {/* Index */}
        <span className="mt-0.5 shrink-0 w-5 text-center text-[10px] font-mono text-slate-600">{index + 1}</span>
        {/* Icon + type */}
        <span className={`mt-0.5 shrink-0 text-xs font-semibold ${meta.color}`}>{meta.icon} {meta.label}</span>
        {/* Timestamp */}
        <span className="mt-0.5 shrink-0 text-[10px] font-mono text-slate-600">{fmtTs(ev.timestamp)}</span>
        {/* Summary */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="min-w-0 flex-1 text-left text-xs text-slate-400 hover:text-slate-200 truncate"
        >
          {eventSummary(ev)}
        </button>
        {ev.costUsd && (
          <span className="shrink-0 text-[10px] font-mono text-amber-600">{fmtCost(ev.costUsd)}</span>
        )}
      </div>

      {expanded && (
        <pre className="mt-2 ml-8 overflow-x-auto whitespace-pre-wrap rounded bg-slate-950 p-2 text-[10px] text-slate-400 font-mono">
          {JSON.stringify(ev.data, null, 2)}
        </pre>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AgentRunReplayView({ delegationId }: Props) {
  const [runs, setRuns] = useState<AgentRun[]>([])
  const [selectedRunId, setSelectedRunId] = useState<string>('')
  const [selectedRun, setSelectedRun] = useState<AgentRun | null>(null)
  const [loadingRuns, setLoadingRuns] = useState(true)
  const [error, setError] = useState('')

  // Replay state
  const [replayIndex, setReplayIndex] = useState<number>(-1)  // -1 = show all
  const [playing, setPlaying] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [playSpeed, setPlaySpeed] = useState(600) // ms per step

  // ── Load runs for this delegation ──
  useEffect(() => {
    setLoadingRuns(true)
    fetch(`/api/agent-runs?delegationId=${encodeURIComponent(delegationId)}`)
      .then(r => r.json())
      .then((data: AgentRun[]) => {
        const sorted = [...data].sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        setRuns(sorted)
        if (sorted.length > 0) setSelectedRunId(sorted[0].id)
      })
      .catch(() => setError('Runs konnten nicht geladen werden'))
      .finally(() => setLoadingRuns(false))
  }, [delegationId])

  // ── Load selected run details ──
  useEffect(() => {
    if (!selectedRunId) { setSelectedRun(null); return }
    fetch(`/api/agent-runs/${selectedRunId}`)
      .then(r => r.ok ? r.json() as Promise<AgentRun> : r.json().then(e => { throw new Error((e as { error?: string }).error ?? 'Fehler') }))
      .then(run => { setSelectedRun(run); setReplayIndex(-1); setPlaying(false) })
      .catch(e => setError(String(e.message ?? e)))
  }, [selectedRunId])

  // ── Playback ──
  const stopPlay = useCallback(() => {
    setPlaying(false)
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
  }, [])

  const startPlay = useCallback(() => {
    if (!selectedRun) return
    const total = selectedRun.traceEvents.length
    if (total === 0) return

    // If at end, restart from beginning
    setReplayIndex(prev => {
      const start = prev >= total - 1 ? 0 : prev + 1
      return start
    })

    setPlaying(true)
    intervalRef.current = setInterval(() => {
      setReplayIndex(prev => {
        const next = prev + 1
        if (next >= total) {
          stopPlay()
          return prev
        }
        return next
      })
    }, playSpeed)
  }, [selectedRun, playSpeed, stopPlay])

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current) }, [])

  const events = selectedRun?.traceEvents ?? []
  const visibleEvents = replayIndex === -1 ? events : events.slice(0, replayIndex + 1)
  const totalEvents = events.length

  function formatDuration(run: AgentRun): string {
    if (!run.completedAt) return 'Läuft'
    const ms = new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()
    if (ms < 1000) return `${ms}ms`
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
    return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Agent Run Replay</h2>
        {runs.length > 0 && (
          <select
            value={selectedRunId}
            onChange={e => setSelectedRunId(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            {runs.map(r => (
              <option key={r.id} value={r.id}>
                {new Date(r.startedAt).toLocaleDateString('de-DE')} {new Date(r.startedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} — {r.model} — {r.status}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="px-4 py-4">
        {loadingRuns && <p className="py-4 text-center text-sm text-slate-500 animate-pulse">Lade Runs…</p>}
        {error && <p className="rounded border border-red-700/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</p>}
        {!loadingRuns && runs.length === 0 && !error && (
          <p className="py-8 text-center text-sm text-slate-500">Noch keine Runs für diese Delegation.</p>
        )}

        {selectedRun && (
          <>
            {/* Run metadata */}
            <div className="mb-4 flex flex-wrap gap-3">
              <span className={`rounded border px-2 py-1 text-xs font-medium ${STATUS_STYLES[selectedRun.status] ?? STATUS_STYLES.queued}`}>
                {selectedRun.status}
              </span>
              <span className="text-xs text-slate-500">Modell: <span className="font-mono text-slate-300">{selectedRun.model}</span></span>
              <span className="text-xs text-slate-500">Dauer: <span className="text-slate-300">{formatDuration(selectedRun)}</span></span>
              <span className="text-xs text-slate-500">Tokens: <span className="text-slate-300">{selectedRun.tokenInput.toLocaleString()} / {selectedRun.tokenOutput.toLocaleString()}</span></span>
              {selectedRun.totalCostUsd > 0 && (
                <span className="text-xs text-slate-500">Kosten: <span className="text-amber-400">{fmtCost(selectedRun.totalCostUsd)}</span></span>
              )}
              {totalEvents > 0 && (
                <span className="text-xs text-slate-500">
                  Events: <span className="text-slate-300">{replayIndex === -1 ? totalEvents : `${replayIndex + 1} / ${totalEvents}`}</span>
                </span>
              )}
            </div>

            {/* Replay controls */}
            {totalEvents > 0 && (
              <div className="mb-4 flex items-center gap-2">
                <button
                  onClick={() => { stopPlay(); setReplayIndex(0) }}
                  title="Zum Anfang"
                  className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:bg-slate-800"
                >⏮</button>
                <button
                  onClick={() => { stopPlay(); setReplayIndex(i => Math.max(0, i - 1)) }}
                  disabled={replayIndex <= 0}
                  title="Schritt zurück"
                  className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-40"
                >◀</button>

                {playing ? (
                  <button
                    onClick={stopPlay}
                    className="rounded-md border border-amber-700/60 bg-amber-950/30 px-3 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-950/50"
                  >⏸ Pause</button>
                ) : (
                  <button
                    onClick={startPlay}
                    className="rounded-md border border-violet-700/60 bg-violet-950/30 px-3 py-1 text-xs font-semibold text-violet-300 hover:bg-violet-950/50"
                  >▶ Replay</button>
                )}

                <button
                  onClick={() => { stopPlay(); setReplayIndex(i => Math.min(totalEvents - 1, i + 1)) }}
                  disabled={replayIndex >= totalEvents - 1}
                  title="Schritt vor"
                  className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-40"
                >▶</button>
                <button
                  onClick={() => { stopPlay(); setReplayIndex(-1) }}
                  title="Alle Events anzeigen"
                  className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:bg-slate-800"
                >⏭</button>

                {/* Speed selector */}
                <div className="ml-auto flex items-center gap-1.5 text-xs text-slate-500">
                  Geschwindigkeit:
                  {[200, 400, 600, 1000, 2000].map(ms => (
                    <button
                      key={ms}
                      onClick={() => { setPlaySpeed(ms); if (playing) { stopPlay(); } }}
                      className={`rounded px-1.5 py-0.5 text-[10px] ${playSpeed === ms ? 'bg-violet-900/60 text-violet-300' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      {ms < 1000 ? `${ms}ms` : `${ms / 1000}s`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Progress bar */}
            {totalEvents > 0 && replayIndex !== -1 && (
              <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-violet-600 transition-all"
                  style={{ width: `${((replayIndex + 1) / totalEvents) * 100}%` }}
                />
              </div>
            )}

            {/* Result summary */}
            {selectedRun.resultSummary && (
              <div className="mb-3 rounded-lg border border-sky-800/40 bg-sky-950/20 px-3 py-2">
                <p className="mb-1 text-xs font-semibold text-sky-400">Ergebnis</p>
                <p className="text-xs text-sky-200/80">{selectedRun.resultSummary}</p>
              </div>
            )}
            {selectedRun.errorMessage && (
              <div className="mb-3 rounded-lg border border-red-800/40 bg-red-950/20 px-3 py-2">
                <p className="mb-1 text-xs font-semibold text-red-400">Fehler</p>
                <p className="text-xs text-red-200/80">{selectedRun.errorMessage}</p>
              </div>
            )}

            {/* Events timeline */}
            {totalEvents === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500">Keine Trace-Events aufgezeichnet.</p>
            ) : (
              <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
                {visibleEvents.map((ev, i) => (
                  <EventCard
                    key={ev.id}
                    ev={ev}
                    index={i}
                    highlight={replayIndex !== -1 && i === replayIndex}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
