export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import type { AgentLog } from '@/lib/models/delegation'
import { killProcess } from '@/lib/process-registry'
import {
  createDelegationRepository,
  SINGLE_TENANT_USER_ID,
} from '@/lib/repositories/delegationRepository'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const delegation = await repo.findById(id)

  if (!delegation) {
    return NextResponse.json({ error: 'Delegation nicht gefunden' }, { status: 404 })
  }

  if (!['running', 'pending', 'approved'].includes(delegation.status)) {
    return NextResponse.json(
      { error: `Delegation kann nicht abgebrochen werden — Status ist '${delegation.status}'` },
      { status: 400 },
    )
  }

  // Try to kill the OS process if it's running
  const killResult = delegation.status === 'running'
    ? killProcess(id)
    : { killed: false, reason: 'Kein laufender Prozess (Status war nicht running)' }

  const now = new Date().toISOString()
  const cancelLog: AgentLog = {
    timestamp: now,
    type: 'error',
    message: `⛔ Abgebrochen — ${killResult.reason}`,
  }

  await repo.update(id, {
    status: 'cancelled',
    errorMessage: 'Manuell abgebrochen',
    logs: [...(delegation.logs ?? []), cancelLog],
  })

  return NextResponse.json({
    cancelled: true,
    delegationId: id,
    processKilled: killResult.killed,
    reason: killResult.reason,
  })
}
