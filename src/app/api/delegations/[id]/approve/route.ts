import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { AgentLog, Delegation } from '@/lib/models/delegation'

const DELEGATIONS_FILE = path.join(process.cwd(), 'config', 'delegations.json')

function readDelegations(): Delegation[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(DELEGATIONS_FILE, 'utf-8')) as unknown
    return Array.isArray(parsed) ? parsed as Delegation[] : []
  } catch {
    return []
  }
}

function writeDelegationsAtomic(delegations: Delegation[]): void {
  const dir = path.dirname(DELEGATIONS_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = `${DELEGATIONS_FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(delegations, null, 2), 'utf-8')
  fs.renameSync(tmp, DELEGATIONS_FILE)
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const delegations = readDelegations()
  const index = delegations.findIndex(delegation => delegation.id === params.id)

  if (index < 0) {
    return NextResponse.json({ error: 'Delegation nicht gefunden' }, { status: 404 })
  }

  const delegation = delegations[index]
  if (delegation.status !== 'pending') {
    return NextResponse.json(
      { error: `Delegation kann nicht genehmigt werden - Status ist '${delegation.status}'.` },
      { status: 409 },
    )
  }

  if (delegation.contract.riskClass === 'C') {
    return NextResponse.json(
      { error: 'RiskClass C braucht manuelle Freigabe in der App.' },
      { status: 403 },
    )
  }

  const body = await safeReadBody(request)
  const now = new Date().toISOString()
  const source = typeof body.source === 'string' && body.source.trim()
    ? body.source.trim()
    : 'api'
  const note = typeof body.note === 'string' && body.note.trim()
    ? ` (${body.note.trim()})`
    : ''

  const log: AgentLog = {
    timestamp: now,
    type: 'success',
    message: `Delegation genehmigt durch ${source}${note}.`,
  }

  const updated: Delegation = {
    ...delegation,
    status: 'approved',
    approvalId: delegation.approvalId ?? `approval-${Date.now()}`,
    contract: {
      ...delegation.contract,
      requiresApproval: false,
    },
    logs: [...(delegation.logs ?? []), log],
    updatedAt: now,
  }

  delegations[index] = updated
  writeDelegationsAtomic(delegations)

  return NextResponse.json(updated)
}

async function safeReadBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = await request.json() as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {}
  } catch {
    return {}
  }
}
