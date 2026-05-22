import { useEffect, useRef, useState } from 'react'

export interface StreamEvent {
  type: 'status' | 'log' | 'progress' | 'complete' | 'error'
  status?: string
  message?: string
  progress?: number // 0-100
  actualCostUsd?: number
  timestamp: string
}

interface UseDelegationStreamResult {
  events: StreamEvent[]
  isConnected: boolean
  lastEvent: StreamEvent | null
  actualCostUsd: number | null
}

export function extractCostFromPayload(raw: unknown): number | null {
  if (raw == null || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  if (typeof obj.actualCostUsd === 'number') return obj.actualCostUsd
  return null
}

const MAX_EVENTS = 50

/**
 * Opens an SSE connection to /api/delegations/[id]/stream when enabled=true.
 * Normalises the server's 'init', 'logs', and 'status' events into StreamEvent objects.
 * Auto-closes when a terminal event (complete / error) is received.
 * Fail-open: on connection error sets isConnected=false and does not throw.
 */
export function useDelegationStream(
  delegationId: string,
  enabled: boolean,
): UseDelegationStreamResult {
  const [events, setEvents] = useState<StreamEvent[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState<StreamEvent | null>(null)
  const [actualCostUsd, setActualCostUsd] = useState<number | null>(null)
  const esRef = useRef<EventSource | null>(null)

  const pushEvent = (event: StreamEvent) => {
    setEvents(prev => {
      const next = [...prev, event]
      return next.length > MAX_EVENTS ? next.slice(next.length - MAX_EVENTS) : next
    })
    setLastEvent(event)
  }

  const closeStream = () => {
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }
    setIsConnected(false)
  }

  useEffect(() => {
    if (!enabled || !delegationId) return

    // Reset state on new connection
    setEvents([])
    setLastEvent(null)
    setIsConnected(false)

    const es = new EventSource(`/api/delegations/${delegationId}/stream`)
    esRef.current = es

    // 'init' event: initial snapshot from the server
    es.addEventListener('init', (e: Event) => {
      const raw = (e as MessageEvent<string>).data
      try {
        const data = JSON.parse(raw) as {
          status: string
          actualCostUsd?: number
          logs?: Array<{ timestamp: string; message: string }>
        }
        setIsConnected(true)

        const cost = extractCostFromPayload(data)
        if (cost !== null) setActualCostUsd(cost)

        const initEvent: StreamEvent = {
          type: 'status',
          status: data.status,
          message: `Status: ${data.status}`,
          actualCostUsd: cost ?? undefined,
          timestamp: new Date().toISOString(),
        }
        pushEvent(initEvent)

        // Surface any initial logs
        if (data.logs && data.logs.length > 0) {
          const lastLog = data.logs[data.logs.length - 1]
          if (lastLog) {
            const logEvent: StreamEvent = {
              type: 'log',
              message: lastLog.message,
              timestamp: lastLog.timestamp,
            }
            pushEvent(logEvent)
          }
        }
      } catch {
        // malformed payload — ignore
      }
    })

    // 'logs' event: incremental log entries
    es.addEventListener('logs', (e: Event) => {
      const raw = (e as MessageEvent<string>).data
      try {
        const data = JSON.parse(raw) as {
          logs: Array<{ timestamp: string; message: string; type?: string }>
        }
        for (const log of data.logs) {
          const logEvent: StreamEvent = {
            type: 'log',
            message: log.message,
            timestamp: log.timestamp,
          }
          pushEvent(logEvent)
        }
      } catch {
        // malformed payload — ignore
      }
    })

    // 'status' event: delegation status changed
    es.addEventListener('status', (e: Event) => {
      const raw = (e as MessageEvent<string>).data
      try {
        const data = JSON.parse(raw) as { status: string; actualCostUsd?: number }
        const isTerminal =
          data.status === 'completed' ||
          data.status === 'failed' ||
          data.status === 'cancelled'

        const cost = extractCostFromPayload(data)
        if (cost !== null) setActualCostUsd(cost)

        const eventType: StreamEvent['type'] = isTerminal
          ? data.status === 'completed'
            ? 'complete'
            : 'error'
          : 'status'

        const statusEvent: StreamEvent = {
          type: eventType,
          status: data.status,
          message: `Status geändert: ${data.status}`,
          actualCostUsd: cost ?? undefined,
          timestamp: new Date().toISOString(),
        }
        pushEvent(statusEvent)

        if (isTerminal) {
          closeStream()
        }
      } catch {
        // malformed payload — ignore
      }
    })

    es.onerror = () => {
      setIsConnected(false)
      // Do not throw — fail-open
    }

    return () => {
      closeStream()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delegationId, enabled])

  return { events, isConnected, lastEvent, actualCostUsd }
}
