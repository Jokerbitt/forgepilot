import { NextRequest } from 'next/server'
import { apiLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Simple in-memory event emitter for SSE clients
// In production with multiple instances, use Redis pub/sub or Postgres LISTEN/NOTIFY
type SSEClient = {
  id: string
  controller: ReadableStreamDefaultController
}

const clients = new Set<SSEClient>()

export function broadcastEvent(event: string, data: unknown): void {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const client of clients) {
    try {
      client.controller.enqueue(new TextEncoder().encode(message))
    } catch {
      clients.delete(client)
    }
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  const clientId = crypto.randomUUID()

  const stream = new ReadableStream({
    start(controller) {
      const client: SSEClient = { id: clientId, controller }
      clients.add(client)

      // Send initial connected event
      controller.enqueue(
        new TextEncoder().encode(`event: connected\ndata: {"clientId":"${clientId}"}\n\n`)
      )

      // Heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(': heartbeat\n\n'))
        } catch {
          clearInterval(heartbeat)
          clients.delete(client)
        }
      }, 30_000)

      // Cleanup on disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
        clients.delete(client)
        apiLogger.info({ event: 'sse.disconnect', clientId }, 'SSE client disconnected')
      })

      apiLogger.info({ event: 'sse.connect', clientId, total: clients.size }, 'SSE client connected')
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    },
  })
}
