import { type NextRequest, NextResponse } from 'next/server'
import { getQueueStats, selectNextBatch } from '@/lib/delegations/queue'
import { delegationLogger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BATCH = 3
const MAX_CONCURRENT = 2

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (secret) {
    return request.headers.get('authorization') === `Bearer ${secret}`
  }
  return process.env.NODE_ENV !== 'production'
}

function getAppBaseUrl(): string {
  const configured =
    process.env.NEXTAUTH_URL ??
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_BASE_URL

  if (configured) return configured.replace(/\/$/, '')

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, '').replace(/\/$/, '')}`
  }

  return 'http://localhost:3000'
}

async function triggerDelegation(id: string): Promise<{ id: string; status: number; ok: boolean }> {
  const response = await fetch(`${getAppBaseUrl()}/api/delegations/${id}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })

  return { id, status: response.status, ok: response.ok }
}

async function runQueue(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    delegationLogger.warn({ event: 'cron.delegation-queue.unauthorized' })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const batch = selectNextBatch({ max: MAX_BATCH, maxConcurrent: MAX_CONCURRENT })

  if (batch.length === 0) {
    delegationLogger.info({
      event: 'cron.delegation-queue.empty',
      reason: 'no approved delegations or concurrency limit reached',
    })
    return NextResponse.json({
      ok: true,
      triggered: 0,
      failed: 0,
      results: [],
      stats: getQueueStats(),
      timestamp: new Date().toISOString(),
    })
  }

  delegationLogger.info({
    event: 'cron.delegation-queue.triggered',
    count: batch.length,
    ids: batch.map(d => d.id),
  })

  const settled = await Promise.allSettled(batch.map(d => triggerDelegation(d.id)))
  const results = settled.map((result, index) => {
    const id = batch[index]?.id ?? 'unknown'
    if (result.status === 'fulfilled') return result.value
    return { id, status: 0, ok: false, error: String(result.reason) }
  })

  const triggered = results.filter(r => r.ok).length
  const failed = results.length - triggered

  return NextResponse.json({
    ok: failed === 0,
    triggered,
    failed,
    results,
    stats: getQueueStats(),
    timestamp: new Date().toISOString(),
  }, { status: failed === 0 ? 200 : 207 })
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return runQueue(request)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return runQueue(request)
}
