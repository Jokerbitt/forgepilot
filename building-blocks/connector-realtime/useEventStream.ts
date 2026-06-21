'use client'
/**
 * Client hook to consume the SSE realtime endpoint.
 * Destination: src/lib/realtime/useEventStream.ts
 *
 *   const { last, connected } = useEventStream<Task>(`/api/realtime/board-${id}`, 'task.updated')
 */
import { useEffect, useState } from 'react'

export function useEventStream<T = unknown>(url: string, eventType: string): { last: T | null; connected: boolean } {
  const [last, setLast] = useState<T | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const source = new EventSource(url)
    source.onopen = () => setConnected(true)
    source.onerror = () => setConnected(false)
    const handler = (e: MessageEvent) => {
      try { setLast(JSON.parse(e.data) as T) } catch { /* ignore malformed frame */ }
    }
    source.addEventListener(eventType, handler as EventListener)
    return () => {
      source.removeEventListener(eventType, handler as EventListener)
      source.close()
    }
  }, [url, eventType])

  return { last, connected }
}
