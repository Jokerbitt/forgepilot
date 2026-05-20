export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { appendTraceEvent, getRun } from '@/lib/agent-runs/store'
import type { TraceEvent } from '@/lib/models/agent-run'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json() as Partial<Omit<TraceEvent, 'id' | 'agentRunId'>>
  if (!body.type || !body.timestamp || !body.data) {
    return NextResponse.json(
      { error: 'type, timestamp, data required' },
      { status: 400 },
    )
  }
  const event = appendTraceEvent(id, body as Omit<TraceEvent, 'id' | 'agentRunId'>)
  if (!event) return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  return NextResponse.json(event, { status: 201 })
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const run = getRun(id)
  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(run.traceEvents)
}
