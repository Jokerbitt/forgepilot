import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { Delegation, AgentLog } from '@/lib/models/delegation'
import { killProcess } from '@/lib/process-registry'

const DELEGATIONS_FILE = path.join(process.cwd(), 'config', 'delegations.json')

function readDelegations(): Delegation[] {
  try {
    return JSON.parse(fs.readFileSync(DELEGATIONS_FILE, 'utf-8')) as Delegation[]
  } catch {
    return []
  }
}

function writeDelegationsAtomic(delegations: Delegation[]) {
  const dir = path.dirname(DELEGATIONS_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = DELEGATIONS_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(delegations, null, 2), 'utf-8')
  fs.renameSync(tmp, DELEGATIONS_FILE)
}

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { id } = params

  const delegations = readDelegations()
  const idx = delegations.findIndex(d => d.id === id)

  if (idx < 0) {
    return NextResponse.json({ error: 'Delegation nicht gefunden' }, { status: 404 })
  }

  const delegation = delegations[idx]

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

  delegations[idx] = {
    ...delegation,
    status: 'cancelled',
    errorMessage: 'Manuell abgebrochen',
    logs: [...(delegation.logs ?? []), cancelLog],
    updatedAt: now,
  }

  writeDelegationsAtomic(delegations)

  return NextResponse.json({
    cancelled: true,
    delegationId: id,
    processKilled: killResult.killed,
    reason: killResult.reason,
  })
}
