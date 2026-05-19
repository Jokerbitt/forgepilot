import { NextResponse } from 'next/server'
import { getAutonomousConfig, saveAutonomousConfig } from '@/lib/config/autonomous-config'
import type { AutonomousConfig } from '@/lib/config/autonomous-config'

export async function GET(): Promise<NextResponse<AutonomousConfig>> {
  const config = getAutonomousConfig()
  return NextResponse.json(config)
}

export async function POST(request: Request): Promise<NextResponse<AutonomousConfig | { error: string }>> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Body must be an object' }, { status: 400 })
  }

  const raw = body as Record<string, unknown>

  const update: Partial<AutonomousConfig> = {}

  if (typeof raw.enabled === 'boolean') update.enabled = raw.enabled
  if (typeof raw.autoApproveDelegations === 'boolean') update.autoApproveDelegations = raw.autoApproveDelegations
  if (typeof raw.autoExecuteOnApproval === 'boolean') update.autoExecuteOnApproval = raw.autoExecuteOnApproval
  if (raw.riskThreshold === 'low' || raw.riskThreshold === 'medium' || raw.riskThreshold === 'high') {
    update.riskThreshold = raw.riskThreshold
  }

  const saved = saveAutonomousConfig(update)
  return NextResponse.json(saved)
}
