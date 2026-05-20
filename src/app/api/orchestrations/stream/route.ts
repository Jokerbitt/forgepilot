/**
 * SSE endpoint for live-streaming orchestrated run updates.
 *
 * Internally polls the run store every 500 ms and pushes a `runs` event
 * whenever the payload changes. The client closes the connection; the server
 * detects this via `request.signal` and cleans up the interval.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { listRuns } from '@/lib/agents/orchestrated-run'
import type { OrchestratedRun } from '@/lib/agents/orchestrated-run'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRuns(): OrchestratedRun[] {
  return listRuns()
}

function encodeEvent(event: string, data: unknown, encoder: TextEncoder): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  const encoder = new TextEncoder()
  let closed = false

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown): void => {
        if (closed) return
        controller.enqueue(encodeEvent(event, data, encoder))
      }

      // Send initial snapshot immediately
      send('runs', getRuns())

      let lastSnapshot = JSON.stringify(getRuns())

      const interval = setInterval(() => {
        if (closed) return
        const current = getRuns()
        const snapshot = JSON.stringify(current)
        // Only emit when data actually changed to reduce client re-renders
        if (snapshot !== lastSnapshot) {
          lastSnapshot = snapshot
          send('runs', current)
        }
      }, 500)

      request.signal.addEventListener('abort', () => {
        closed = true
        clearInterval(interval)
        try {
          controller.close()
        } catch {
          // Already closed — safe to ignore
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
