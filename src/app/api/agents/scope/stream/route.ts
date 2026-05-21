/**
 * GET /api/agents/scope/stream
 *
 * Server-Sent Events endpoint for real-time agent scope claim updates.
 * Replaces the 5-second polling interval in ScopeBoard.tsx.
 *
 * Protocol:
 *   - Initial `claims` event sent immediately with current state
 *   - Heartbeat `ping` event every 15s (keeps connection alive through proxies)
 *   - `claims` event sent whenever scope changes (every 5s check)
 *   - Connection closed automatically after TIMEOUT_MS (client reconnects via EventSource)
 *
 * M162 — SSE Stream für Agent Scope
 */

export const dynamic = 'force-dynamic'

import { getActiveClaims } from '@/lib/agents/scope-lock'

const POLL_INTERVAL_MS  = 5_000     // check for changes every 5s
const HEARTBEAT_MS      = 15_000    // send ping every 15s
const TIMEOUT_MS        = 5 * 60_000 // close after 5 min (client auto-reconnects)

/** Serialize an SSE event */
function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export async function GET(): Promise<Response> {
  const encoder = new TextEncoder()

  let closed = false
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null

  const stream = new ReadableStream({
    start(controller) {
      function push(chunk: string) {
        if (!closed) {
          controller.enqueue(encoder.encode(chunk))
        }
      }

      function cleanup() {
        closed = true
        if (pollTimer)      clearInterval(pollTimer)
        if (heartbeatTimer) clearInterval(heartbeatTimer)
        if (timeoutTimer)   clearTimeout(timeoutTimer)
        try { controller.close() } catch { /* already closed */ }
      }

      // Send initial state immediately
      const initial = getActiveClaims()
      push(sseEvent('claims', { claims: initial, count: initial.length, ts: new Date().toISOString() }))

      // Track last snapshot to detect changes
      let lastSnapshot = JSON.stringify(initial)

      // Poll for scope changes
      pollTimer = setInterval(() => {
        if (closed) return
        const claims = getActiveClaims()
        const snapshot = JSON.stringify(claims)
        if (snapshot !== lastSnapshot) {
          lastSnapshot = snapshot
          push(sseEvent('claims', { claims, count: claims.length, ts: new Date().toISOString() }))
        }
      }, POLL_INTERVAL_MS)

      // Heartbeat to keep proxies from closing the connection
      heartbeatTimer = setInterval(() => {
        push(sseEvent('ping', { ts: new Date().toISOString() }))
      }, HEARTBEAT_MS)

      // Auto-close after TIMEOUT_MS (client reconnects via EventSource auto-reconnect)
      timeoutTimer = setTimeout(cleanup, TIMEOUT_MS)
    },

    cancel() {
      closed = true
      if (pollTimer)      clearInterval(pollTimer)
      if (heartbeatTimer) clearInterval(heartbeatTimer)
      if (timeoutTimer)   clearTimeout(timeoutTimer)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',  // disable nginx buffering
    },
  })
}
