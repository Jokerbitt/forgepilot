import { NextRequest, NextResponse } from 'next/server'
import type { AgentLog } from '@/lib/models/delegation'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { ImportLogsSchema } from '@/lib/validation/schemas'

export const dynamic = 'force-dynamic'

/**
 * Classify a terminal output line into an AgentLog type.
 */
function classifyLine(line: string): AgentLog['type'] {
  const l = line.trimStart()
  if (l.startsWith('$') || l.startsWith('> ') || l.startsWith('npm ') || l.startsWith('git ')) return 'command'
  if (l.startsWith('✅') || l.startsWith('✓') || /^\d+ passed/i.test(l)) return 'success'
  if (l.startsWith('❌') || l.startsWith('Error') || l.startsWith('error') || /failed|FAIL/i.test(l)) return 'error'
  if (l.startsWith('💭') || l.startsWith('Thinking') || l.startsWith('I ') || l.startsWith('Let me')) return 'thought'
  return 'info'
}

/**
 * POST /api/delegations/[id]/import-logs
 *
 * Accepts raw terminal output (string), splits into lines, classifies each
 * line as an AgentLog entry, and appends to the delegation's log array.
 * Useful for importing output from a claude CLI session run outside ForgePilot.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)

  const delegation = await repo.findById(id)
  if (!delegation) {
    return NextResponse.json({ error: 'Delegation nicht gefunden' }, { status: 404 })
  }

  const body = await parseBody(req, ImportLogsSchema)
  if (isValidationError(body)) return body

  const ts = new Date().toISOString()
  const newLogs: AgentLog[] = body.output
    .split('\n')
    .map(l => l.trimEnd())
    .filter(l => l.length > 0)
    .map(line => ({
      timestamp: ts,
      type: classifyLine(line),
      message: line.substring(0, 500),
    }))

  await repo.update(id, {
    ...(body.status !== undefined ? { status: body.status } : {}),
    logs: [...(delegation.logs ?? []), ...newLogs],
  })

  return NextResponse.json({ imported: newLogs.length })
}
