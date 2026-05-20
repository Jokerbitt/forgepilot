/**
 * GET /api/webhooks/events — webhook event log + stats (M135)
 *
 * Query params:
 *   ?source=linear|intake|n8n|github|sentry|other
 *   ?status=processed|ignored|skipped|failed|invalid-signature
 *   ?since=<ISO>
 *   ?limit=<n>          default 100
 *
 * Returns `{ stats, events }`.
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getWebhookStats, listWebhookEvents } from '@/lib/webhooks/event-log'
import type { WebhookSource, WebhookStatus } from '@/lib/webhooks/event-log'

const SOURCES = new Set<WebhookSource>(['linear', 'intake', 'n8n', 'github', 'sentry', 'other'])
const STATUSES = new Set<WebhookStatus>(['processed', 'ignored', 'skipped', 'failed', 'invalid-signature'])

export function GET(req: NextRequest): NextResponse {
  const { searchParams } = req.nextUrl

  const sourceParam = searchParams.get('source')
  const statusParam = searchParams.get('status')
  const sinceParam = searchParams.get('since') ?? undefined
  const limitParam = Number(searchParams.get('limit') ?? '100')

  const source = sourceParam && SOURCES.has(sourceParam as WebhookSource) ? (sourceParam as WebhookSource) : undefined
  const status = statusParam && STATUSES.has(statusParam as WebhookStatus) ? (statusParam as WebhookStatus) : undefined
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 500) : 100

  return NextResponse.json({
    stats: getWebhookStats(),
    events: listWebhookEvents({ source, status, since: sinceParam, limit }),
  })
}
