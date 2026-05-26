'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { AgentLog, DelegationStatus, DelegationReport } from '@/lib/models/delegation'

interface LiveLogViewerProps {
  delegationId: string
  initialLogs?: AgentLog[]
  initialStatus?: DelegationStatus
  initialCostEstimate?: number
  onStatusChange?: (status: DelegationStatus, report?: DelegationReport) => void
}

const LOG_TYPE_STYLES: Record<AgentLog['type'], string> = {
  info:    'text-slate-300',
  success: 'text-emerald-400',
  error:   'text-red-400',
  command: 'text-amber-300 font-mono',
  thought: 'text-indigo-300 italic',
}

const LOG_TYPE_PREFIX: Record<AgentLog['type'], string> = {
  info:    '  ',
  success: '✅',
  error:   '❌',
  command: '$ ',
  thought: '💭',
}

const STATUS_STYLES: Record<DelegationStatus, string> = {
  pending:   'border-slate-700 bg-slate-900/40 text-slate-400',
  approved:  'border-blue-800/50 bg-blue-950/20 text-blue-300',
  running:   'border-amber-700/50 bg-amber-950/20 text-amber-300',
  completed: 'border-emerald-700/50 bg-emerald-950/20 text-emerald-300',
  failed:    'border-red-800/50 bg-red-950/20 text-red-300',
  cancelled: 'border-slate-700 bg-slate-900/40 text-slate-400',
  rejected:  'border-red-900/50 bg-red-950/20 text-red-400',
}

const STATUS_LABELS: Record<DelegationStatus, string> = {
  pending:   'Ausstehend',
  approved:  'Freigegeben',
  running:   'Läuft',
  completed: 'Abgeschlossen',
  failed:    'Fehlgeschlagen',
  cancelled: 'Abgebrochen',
  rejected:  'Abgelehnt',
}

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function LiveLogViewer({
  delegationId,
  initialLogs = [],
  initialStatus = 'pending',
  initialCostEstimate = 0,
  onStatusChange,
}: LiveLogViewerProps) {
  const [logs, setLogs] = useState<AgentLog[]>(initialLogs)
  const [status, setStatus] = useState<DelegationStatus>(initialStatus)
  const [actualCost, setActualCost] = useState<number | undefined>(undefined)
  const [costEstimate] = useState(initialCostEstimate)
  const [connected, setConnected] = useState(false)
  const [stopping, setStopping] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const esRef = useRef<EventSource | null>(null)
  const terminal: DelegationStatus[] = ['completed', 'failed', 'cancelled']

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    // Don't stream if already in terminal state
    if (terminal.includes(initialStatus)) return

    const es = new EventSource(`/api/delegations/${delegationId}/stream`)
    esRef.current = es

    es.addEventListener('init', (e) => {
      const data = JSON.parse((e as MessageEvent).data) as {
        status: DelegationStatus
        logs: AgentLog[]
        actualCostUsd?: number
      }
      setLogs(data.logs)
      setStatus(data.status)
      if (data.actualCostUsd !== undefined) setActualCost(data.actualCostUsd)
      setConnected(true)
    })

    es.addEventListener('logs', (e) => {
      const data = JSON.parse((e as MessageEvent).data) as { logs: AgentLog[] }
      setLogs(prev => [...prev, ...data.logs])
      setTimeout(scrollToBottom, 50)
    })

    es.addEventListener('status', (e) => {
      const data = JSON.parse((e as MessageEvent).data) as {
        status: DelegationStatus
        actualCostUsd?: number
        summaryReport?: DelegationReport
      }
      setStatus(data.status)
      if (data.actualCostUsd !== undefined) setActualCost(data.actualCostUsd)
      onStatusChange?.(data.status, data.summaryReport)
      if (terminal.includes(data.status)) {
        es.close()
        setConnected(false)
      }
    })

    es.onerror = () => {
      setConnected(false)
    }

    return () => {
      es.close()
      esRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delegationId])

  const handleStop = async () => {
    setStopping(true)
    await fetch(`/api/delegations/${delegationId}/cancel`, { method: 'POST' })
    setStopping(false)
  }

  const displayCost = actualCost ?? costEstimate
  const budgetPct = costEstimate > 0 ? Math.min(100, Math.round((displayCost / costEstimate) * 100)) : 0

  return (
    <div className="flex flex-col gap-3">
      {/* Status bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}>
            {status === 'running' && (
              <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
            )}
            {STATUS_LABELS[status]}
          </span>
          {connected && (
            <span className="flex items-center gap-1 text-xs text-emerald-500">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              Live-Stream
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Cost meter */}
          {costEstimate > 0 && (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    budgetPct >= 90 ? 'bg-red-500' : budgetPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${budgetPct}%` }}
                />
              </div>
              <span className="text-xs text-slate-400">
                ${displayCost.toFixed(3)} / ${costEstimate.toFixed(2)}
              </span>
            </div>
          )}

          {/* Stop button — only when running */}
          {status === 'running' && (
            <button
              onClick={handleStop}
              disabled={stopping}
              className="rounded border border-red-800/60 bg-red-950/30 px-2.5 py-1 text-xs font-medium text-red-400 transition-colors hover:border-red-600 hover:text-red-300 disabled:opacity-50"
            >
              {stopping ? 'Stoppe…' : '⏹ Stop'}
            </button>
          )}
        </div>
      </div>

      {/* Log window */}
      <div className="h-80 overflow-y-auto rounded border border-slate-800 bg-slate-950 p-3 font-mono text-xs">
        {logs.length === 0 ? (
          <p className="text-slate-600 italic">Keine Logs vorhanden…</p>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="mb-0.5 flex gap-2 leading-relaxed">
              <span className="shrink-0 text-slate-600">{formatTime(log.timestamp)}</span>
              <span className="shrink-0">{LOG_TYPE_PREFIX[log.type]}</span>
              <span className={LOG_TYPE_STYLES[log.type]}>{log.message}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Log count */}
      <p className="text-right text-xs text-slate-600">{logs.length} Log-Einträge</p>
    </div>
  )
}
