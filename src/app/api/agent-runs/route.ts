import { NextResponse } from 'next/server'
import { createRun, getRuns } from '@/lib/agent-runs/store'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const delegationId = searchParams.get('delegationId') ?? undefined
  return NextResponse.json(getRuns(delegationId))
}

export async function POST(req: Request) {
  const body = await req.json() as { delegationId?: string; contractId?: string; model?: string }
  if (!body.delegationId || !body.contractId || !body.model) {
    return NextResponse.json(
      { error: 'delegationId, contractId, model required' },
      { status: 400 },
    )
  }
  const run = createRun(body.delegationId, body.contractId, body.model)
  return NextResponse.json(run, { status: 201 })
}
