import { NextResponse } from 'next/server'
import { evaluatePolicy } from '@/lib/policy/engine'
import type { TaskContract } from '@/lib/models/delegation'

export async function POST(req: Request) {
  const body = await req.json() as Partial<TaskContract>

  if (!body.id || !body.goal || !body.riskClass) {
    return NextResponse.json(
      { error: 'id, goal, riskClass required' },
      { status: 400 },
    )
  }

  const contract = body as TaskContract
  const decision = evaluatePolicy(contract)

  const status = decision.verdict === 'deny' ? 403 : 200
  return NextResponse.json(decision, { status })
}
