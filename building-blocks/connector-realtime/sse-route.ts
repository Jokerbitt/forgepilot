/**
 * Realtime SSE endpoint — GET /api/realtime/[channel]
 * Streams broker events for a channel to the browser as Server-Sent Events.
 * Copy to: src/app/api/realtime/[channel]/route.ts
 *
 * Protect it like any route (auth + authorize the channel) before production.
 */
import { broker } from '@/lib/realtime/broker'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ channel: string }> },
) {
  const { channel } = await params
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: { type: string; data: unknown }) => {
        controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`))
      }
      send({ type: 'ready', data: { channel } })
      const unsubscribe = broker.subscribe(channel, send)
      // Heartbeat keeps proxies from closing an idle connection.
      const heartbeat = setInterval(() => controller.enqueue(encoder.encode(': ping\n\n')), 25_000)
      const close = () => { clearInterval(heartbeat); unsubscribe(); try { controller.close() } catch { /* already closed */ } }
      // @ts-expect-error — Next provides the request signal on the stream context in practice
      _req.signal?.addEventListener('abort', close)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
