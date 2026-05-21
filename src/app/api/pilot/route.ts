export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { runPilot } from '@/lib/pilot/orchestrator'
import type { PilotInput } from '@/lib/pilot/orchestrator'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { PilotInputSchema } from '@/lib/validation/schemas'

export async function POST(req: NextRequest) {
  const body = await parseBody(req, PilotInputSchema)
  if (isValidationError(body)) return body

  const result = await runPilot(body as PilotInput)
  const status = result.status === 'completed' ? 200 : 422
  return NextResponse.json(result, { status })
}
