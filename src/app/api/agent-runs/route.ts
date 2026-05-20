import { type NextRequest, NextResponse } from 'next/server'
import { createRun, getRuns } from '@/lib/agent-runs/store'
import { parseBody } from '@/lib/validation/api'
import { CreateAgentRunSchema } from '@/lib/validation/schemas'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const delegationId = searchParams.get('delegationId') ?? undefined
  return NextResponse.json(getRuns(delegationId))
}

export async function POST(req: NextRequest) {
  const result = await parseBody(req, CreateAgentRunSchema)
  if (result instanceof NextResponse) return result

  const run = createRun(result.delegationId, result.contractId, result.model)
  return NextResponse.json(run, { status: 201 })
}
