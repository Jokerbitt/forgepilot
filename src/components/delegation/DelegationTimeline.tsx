'use client'

import type { Delegation, AgentLog } from '@/lib/models/delegation'

export interface TimelineEvent {
  id: string
  type: 'created' | 'approved' | 'started' | 'log' | 'completed' | 'failed'
  label: string
  timestamp: string
  details?: string
}

export function buildTimelineEvents(delegation: Delegation): TimelineEvent[] {
  const events: TimelineEvent[] = []

  // Created
  events.push({
    id: 'created',
    type: 'created',
    label: 'Delegation erstellt',
    timestamp: delegation.createdAt,
  })

  // Approved — detect from logs or status
  const approvalLog = delegation.logs?.find(
    l => l.type === 'success' && (l.message.includes('freigegeben') || l.message.includes('approved'))
  )
  if (approvalLog) {
    events.push({
      id: 'approved',
      type: 'approved',
      label: 'Freigegeben',
      timestamp: approvalLog.timestamp,
      details: approvalLog.message.slice(0, 100),
    })
  } else if (
    delegation.status === 'approved' ||
    delegation.status === 'running' ||
    delegation.status === 'completed' ||
    delegation.status === 'failed'
  ) {
    // Infer approval from status progression
    events.push({
      id: 'approved',
      type: 'approved',
      label: 'Freigegeben',
      timestamp: delegation.updatedAt,
    })
  }

  // Started — detect from logs
  const startLog = delegation.logs?.find(
    l => l.message.toLowerCase().includes('start') || l.message.toLowerCase().includes('läuft')
  )
  if (startLog && (delegation.status === 'running' || delegation.status === 'completed' || delegation.status === 'failed')) {
    events.push({
      id: 'started',
      type: 'started',
      label: 'Gestartet',
      timestamp: startLog.timestamp,
    })
  } else if (delegation.status === 'running' || delegation.status === 'completed' || delegation.status === 'failed') {
    events.push({
      id: 'started',
      type: 'started',
      label: 'Gestartet',
      timestamp: delegation.updatedAt,
    })
  }

  // Intermediate log entries (non-approval, non-start)
  const logEntries: AgentLog[] = delegation.logs?.filter(l => {
    const msg = l.message.toLowerCase()
    const isApprovalMsg = msg.includes('freigegeben') || msg.includes('approved')
    const isStartMsg = msg.includes('start') || msg.includes('läuft')
    return !isApprovalMsg && !isStartMsg
  }) ?? []

  logEntries.forEach((log, idx) => {
    events.push({
      id: `log-${idx}`,
      type: 'log',
      label: logTypeLabel(log.type),
      timestamp: log.timestamp,
      details: log.message.slice(0, 100),
    })
  })

  // Completed or Failed
  if (delegation.status === 'completed') {
    events.push({
      id: 'completed',
      type: 'completed',
      label: 'Abgeschlossen',
      timestamp: delegation.updatedAt,
      details: delegation.summaryReport?.keyPoints?.[0]?.slice(0, 100),
    })
  } else if (delegation.status === 'failed') {
    events.push({
      id: 'failed',
      type: 'failed',
      label: 'Fehlgeschlagen',
      timestamp: delegation.updatedAt,
      details: delegation.errorMessage?.slice(0, 100),
    })
  }

  // Sort chronologically, deduplicate by id
  const seen = new Set<string>()
  return events
    .filter(e => {
      if (seen.has(e.id)) return false
      seen.add(e.id)
      return true
    })
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
}

function logTypeLabel(type: AgentLog['type']): string {
  switch (type) {
    case 'success': return 'Erfolg'
    case 'error':   return 'Fehler'
    case 'command': return 'Command'
    case 'thought': return 'Gedanke'
    default:        return 'Info'
  }
}

function StatusIcon({ type, isLast }: { type: TimelineEvent['type']; isLast: boolean }) {
  if (type === 'completed') {
    return (
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-900/60 border border-emerald-700 text-emerald-400 text-sm"
        aria-label="Abgeschlossen"
      >
        ✓
      </span>
    )
  }
  if (type === 'failed') {
    return (
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full bg-red-900/60 border border-red-700 text-red-400 text-sm"
        aria-label="Fehlgeschlagen"
      >
        ✕
      </span>
    )
  }
  if (type === 'started' && isLast) {
    // Pulsing circle for active running state
    return (
      <span className="relative flex h-7 w-7 items-center justify-center" aria-label="Läuft">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-30" />
        <span className="relative inline-flex h-4 w-4 rounded-full bg-green-600 border border-green-400" />
      </span>
    )
  }
  if (type === 'created') {
    return (
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-800 border border-gray-600 text-gray-400 text-sm"
        aria-label="Erstellt"
      >
        ◆
      </span>
    )
  }
  if (type === 'approved') {
    return (
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-900/60 border border-blue-700 text-blue-400 text-sm"
        aria-label="Freigegeben"
      >
        ✔
      </span>
    )
  }
  if (type === 'started') {
    return (
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full bg-green-900/50 border border-green-800 text-green-400 text-sm"
        aria-label="Gestartet"
      >
        ▶
      </span>
    )
  }
  // log
  return (
    <span
      className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-900 border border-gray-700 text-gray-500 text-xs"
      aria-label="Log"
    >
      ·
    </span>
  )
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return iso
  }
}

interface DelegationTimelineProps {
  delegation: Delegation
}

export function DelegationTimeline({ delegation }: DelegationTimelineProps) {
  const events = buildTimelineEvents(delegation)

  if (events.length === 0) return null

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Timeline</h2>
      <ol className="relative space-y-0">
        {events.map((event, idx) => {
          const isLast = idx === events.length - 1
          return (
            <li key={event.id} className="flex gap-3">
              {/* Connector line + icon */}
              <div className="flex flex-col items-center">
                <StatusIcon type={event.type} isLast={isLast} />
                {!isLast && (
                  <div className="w-px flex-1 bg-gray-800 my-1" style={{ minHeight: '1rem' }} />
                )}
              </div>

              {/* Content */}
              <div className={`pb-4 min-w-0 flex-1 ${isLast ? '' : ''}`}>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className={`text-sm font-medium ${eventLabelColor(event.type)}`}>
                    {event.label}
                  </span>
                  <span className="text-xs text-gray-600 font-mono">
                    {formatTimestamp(event.timestamp)}
                  </span>
                </div>
                {event.details && (
                  <p className="mt-0.5 text-xs text-gray-500 truncate max-w-sm" title={event.details}>
                    {event.details}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function eventLabelColor(type: TimelineEvent['type']): string {
  switch (type) {
    case 'completed': return 'text-emerald-400'
    case 'failed':    return 'text-red-400'
    case 'approved':  return 'text-blue-400'
    case 'started':   return 'text-green-400'
    case 'created':   return 'text-gray-300'
    default:          return 'text-gray-400'
  }
}
