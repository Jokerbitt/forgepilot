export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { evaluatePolicy } from '@/lib/policy/engine'
import type { TaskContract } from '@/lib/models/delegation'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { PolicyEvalSchema } from '@/lib/validation/schemas'

export async function POST(req: NextRequest) {
  const body = await parseBody(req, PolicyEvalSchema)
  if (isValidationError(body)) return body

  const contract = body as unknown as TaskContract
  const decision = evaluatePolicy(contract)

  return NextResponse.json(decision)
}
