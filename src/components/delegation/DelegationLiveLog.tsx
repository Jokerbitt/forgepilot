'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useDelegationStream } from '@/hooks/useDelegationStream'

interface Props {
  delegationId: string
  isRunning: boolean
}

/**
 * Lightweight live-log strip for the delegation detail page.
 * Uses useDelegationStream to connect to the SSE endpoint.
 * Renders nothing when isRunning=false.
 * Auto-refreshes the page (router.refresh) 1.5 s after completion.
 */
export function DelegationLiveLog({ delegationId, isRunning }: Props) {
  const router = useRouter()
  const { events, isConnected, lastEvent } = useDelegationStream(delegationId, isRunning)
  const bottomRef = useRef<HTMLDivElement>(null)
  const refreshedRef = useRef(false)

  // Auto-scroll as new events arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  // Trigger page refresh when stream completes
  useEffect(() => {
    if (!lastEvent) return
    if (lastEvent.type === 'complete' || lastEvent.type === 'error') {
      if (!refreshedRef.current) {
        refreshedRef.current = true
        setTimeout(() => {
          router.refresh()
        }, 1500)
      }
    }
  }, [lastEvent, router])

  if (!isRunning) return null

  const logEvents = events.filter(e => e.type === 'log')
  const progressEvent = [...events].reverse().find(e => e.type === 'progress')
  const progress = progressEvent?.progress ?? null
  const isComplete =
    lastEvent?.type === 'complete' || lastEvent?.type === 'error'

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isConnected && !isComplete ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              Live
            </span>
          ) : isComplete ? (
            <span className="rounded border border-emerald-800/60 bg-emerald-950/30 px-2 py-0.5 text-xs font-semibold text-emerald-400">
              Abgeschlossen
            </span>
          ) : (
            <span className="text-xs text-slate-500">Verbinde…</span>
          )}
        </div>
        <span className="text-[10px] font-mono text-slate-600">{logEvents.length} Logs</span>
      </div>

      {/* Progress bar */}
      {progress !== null && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-violet-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Log area */}
      <div className="max-h-48 overflow-y-auto font-mono text-xs">
        {logEvents.length === 0 ? (
          <p className="italic text-slate-600">Warte auf Agent-Logs…</p>
        ) : (
          logEvents.map((event, i) => (
            <div key={i} className="mb-0.5 flex gap-2 leading-relaxed">
              <span className="shrink-0 text-slate-600">
                {new Date(event.timestamp).toLocaleTimeString('de-DE', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
              <span className="text-slate-300">{event.message}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
