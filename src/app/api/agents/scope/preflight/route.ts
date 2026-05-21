export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { preflight } from '@/lib/agents/scope-lock'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { ScopeLockPreflightSchema } from '@/lib/validation/schemas'

export async function POST(req: NextRequest) {
  const body = await parseBody(req, ScopeLockPreflightSchema)
  if (isValidationError(body)) return body

  const { branch, filePatterns, agentId } = body
  return NextResponse.json(preflight(branch, filePatterns, agentId))
}
