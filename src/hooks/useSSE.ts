'use client'
import { useEffect, useRef } from 'react'

type SSEHandler = (event: MessageEvent) => void

export function useSSE(
  eventHandlers: Record<string, SSEHandler>,
  enabled = true
): void {
  const handlersRef = useRef(eventHandlers)
  handlersRef.current = eventHandlers

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    let es: EventSource | null = null
    let reconnectTimeout: ReturnType<typeof setTimeout>

    function connect() {
      es = new EventSource('/api/events')

      es.addEventListener('connected', () => {
        // Connected successfully
      })

      // Register all event handlers
      for (const [event, handler] of Object.entries(handlersRef.current)) {
        es!.addEventListener(event, handler)
      }

      es.onerror = () => {
        es?.close()
        // Reconnect after 5s on error
        reconnectTimeout = setTimeout(connect, 5_000)
      }
    }

    connect()

    return () => {
      clearTimeout(reconnectTimeout)
      es?.close()
    }
  }, [enabled])
}
