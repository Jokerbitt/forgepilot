export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { refinePlan } from '@/lib/delegations/plan-generator'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { feedback } = (body as Record<string, unknown>)

  if (typeof feedback !== 'string' || feedback.trim().length === 0) {
    return NextResponse.json({ error: 'feedback is required' }, { status: 400 })
  }

  try {
    const updated = await refinePlan({ planId: id, feedback: feedback.trim() })
    return NextResponse.json(updated)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Refinement failed'
    const status = message.includes('nicht gefunden') ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
