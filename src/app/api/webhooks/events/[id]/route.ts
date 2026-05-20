/**
 * GET /api/webhooks/events/[id] — single webhook event with raw body, so the
 * operator can inspect or replay what came in.
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getWebhookEvent } from '@/lib/webhooks/event-log'

// Next.js 15: dynamic-route `params` is now a Promise.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params
  const event = getWebhookEvent(id)
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  return NextResponse.json(event)
}
