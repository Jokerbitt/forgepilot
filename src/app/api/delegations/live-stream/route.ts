export const dynamic = 'force-dynamic'

import fs from 'fs'
import path from 'path'
import type { Delegation } from '@/lib/models/delegation'

const DELEGATIONS_FILE = path.join(process.cwd(), 'config', 'delegations.json')

/**
 * M164 — Global SSE stream for delegation list changes.
 *
 * Sends an event whenever the set of running/recently-completed delegations
 * changes (new item, status change, new log entry). This removes the need for
 * clients to poll GET /api/delegations every N seconds for live updates.
 *
 * Events:
 *   event: delegations  → { delegations: Delegation[], count: number, ts: string }
 *   event: ping         → { ts: string }  (heartbeat every 15 s)
 *
 * Auto-closes after 10 minutes to prevent stale connections.
 */
export async function GET(): Promise<Response> {
  const POLL_MS = 3_000
  const HEARTBEAT_MS = 15_000
  const MAX_DURATION_MS = 10 * 60 * 1_000 // 10 min

  /** Recent = running OR completed/failed within the last 5 minutes */
  const RECENT_WINDOW_MS = 5 * 60 * 1_000

  function readDelegations(): Delegation[] {
    try {
      const raw = fs.readFileSync(DELEGATIONS_FILE, 'utf-8')
      const parsed = JSON.parse(raw) as unknown
      return Array.isArray(parsed) ? (parsed as Delegation[]) : []
    } catch {
      return []
    }
  }

  function getRelevant(delegations: Delegation[]): Delegation[] {
    const cutoff = Date.now() - RECENT_WINDOW_MS
    return delegations.filter(d => {
      if (d.status === 'running') return true
      if (d.status === 'completed' || d.status === 'failed') {
        return new Date(d.updatedAt).getTime() > cutoff
      }
      return false
    })
  }

  function stateHash(delegations: Delegation[]): string {
    return delegations
      .map(d => `${d.id}:${d.status}:${d.updatedAt}:${(d.logs ?? []).length}`)
      .join('|')
  }

  function encode(text: string): Uint8Array {
    return new TextEncoder().encode(text)
  }

  function sseEvent(event: string, data: unknown): Uint8Array {
    return encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }

  let pollTimer: ReturnType<typeof setInterval> | undefined
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined
  let closeTimer: ReturnType<typeof setTimeout> | undefined
  let lastHash = ''

  const stream = new ReadableStream({
    start(controller) {
      // Initial snapshot
      const initial = getRelevant(readDelegations())
      lastHash = stateHash(initial)
      controller.enqueue(
        sseEvent('delegations', {
          delegations: initial,
          count: initial.length,
          ts: new Date().toISOString(),
        }),
      )

      // Poll for changes
      pollTimer = setInterval(() => {
        try {
          const relevant = getRelevant(readDelegations())
          const hash = stateHash(relevant)
          if (hash !== lastHash) {
            lastHash = hash
            controller.enqueue(
              sseEvent('delegations', {
                delegations: relevant,
                count: relevant.length,
                ts: new Date().toISOString(),
              }),
            )
          }
        } catch {
          // file read error — keep stream alive
        }
      }, POLL_MS)

      // Heartbeat
      heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(sseEvent('ping', { ts: new Date().toISOString() }))
        } catch {
          // stream already closed
        }
      }, HEARTBEAT_MS)

      // Auto-close after MAX_DURATION_MS
      closeTimer = setTimeout(() => {
        try {
          controller.close()
        } catch {
          // already closed
        }
      }, MAX_DURATION_MS)
    },

    cancel() {
      if (pollTimer !== undefined) clearInterval(pollTimer)
      if (heartbeatTimer !== undefined) clearInterval(heartbeatTimer)
      if (closeTimer !== undefined) clearTimeout(closeTimer)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
