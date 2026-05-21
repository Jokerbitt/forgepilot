import type { Delegation, AgentLog } from '@/lib/models/delegation'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'

export const dynamic = 'force-dynamic'

const POLL_INTERVAL_MS = 800

async function readDelegation(id: string): Promise<Delegation | null> {
  try {
    const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
    return await repo.findById(id)
  } catch {
    return null
  }
}

function encodeSSE(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

/**
 * GET /api/delegations/[id]/stream
 *
 * Server-Sent Events stream for real-time delegation log updates.
 * Polls the repository every 800ms and pushes new logs to the client.
 * Sends a "status" event when the delegation status changes.
 * Closes the stream when the delegation reaches a terminal state.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const delegation = await readDelegation(id)
  if (!delegation) {
    return new Response('Delegation nicht gefunden', { status: 404 })
  }

  let knownLogCount = 0
  let knownStatus = delegation.status

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial state immediately
      const initial = await readDelegation(id)
      if (initial) {
        knownLogCount = (initial.logs ?? []).length
        knownStatus = initial.status
        controller.enqueue(
          new TextEncoder().encode(
            encodeSSE('init', {
              status: initial.status,
              logs: initial.logs ?? [],
              costEstimateUsd: initial.costEstimateUsd,
              actualCostUsd: initial.actualCostUsd,
            }),
          ),
        )
      }

      const terminal: Delegation['status'][] = ['completed', 'failed', 'cancelled']

      const poll = setInterval(() => {
        void (async () => {
          const current = await readDelegation(id)
          if (!current) {
            clearInterval(poll)
            controller.close()
            return
          }

          const currentLogs = current.logs ?? []

          // Send new logs since last poll
          if (currentLogs.length > knownLogCount) {
            const newLogs: AgentLog[] = currentLogs.slice(knownLogCount)
            knownLogCount = currentLogs.length
            controller.enqueue(
              new TextEncoder().encode(encodeSSE('logs', { logs: newLogs })),
            )
          }

          // Send status change
          if (current.status !== knownStatus) {
            knownStatus = current.status
            controller.enqueue(
              new TextEncoder().encode(
                encodeSSE('status', {
                  status: current.status,
                  actualCostUsd: current.actualCostUsd,
                  summaryReport: current.summaryReport,
                }),
              ),
            )
          }

          // Close stream on terminal state
          if (terminal.includes(current.status)) {
            clearInterval(poll)
            // Small delay so client receives the final status event
            setTimeout(() => {
              try { controller.close() } catch { /* already closed */ }
            }, 1500)
          }
        })()
      }, POLL_INTERVAL_MS)

      // Heartbeat to keep the connection alive through proxies
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(': heartbeat\n\n'))
        } catch {
          clearInterval(heartbeat)
          clearInterval(poll)
        }
      }, 15000)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
