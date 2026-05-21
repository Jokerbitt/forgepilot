export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getAutonomousConfig, saveAutonomousConfig } from '@/lib/config/autonomous-config'
import type { AutonomousConfig } from '@/lib/config/autonomous-config'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { AutonomousConfigSchema } from '@/lib/validation/schemas'

export async function GET(): Promise<NextResponse<AutonomousConfig>> {
  const config = getAutonomousConfig()
  return NextResponse.json(config)
}

export async function POST(request: Request): Promise<NextResponse> {
  const result = await parseBody(request, AutonomousConfigSchema)
  if (isValidationError(result)) return result

  const saved = saveAutonomousConfig(result)
  return NextResponse.json(saved)
}
