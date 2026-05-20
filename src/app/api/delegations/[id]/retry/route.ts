export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { Delegation, AgentLog } from '@/lib/models/delegation'
import { buildRetryPlan } from '@/lib/delegations/retry'

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
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const delegations = readDelegations()
  const idx = delegations.findIndex(d => d.id === id)

  if (idx < 0) {
    return NextResponse.json({ error: 'Delegation nicht gefunden' }, { status: 404 })
  }

  const delegation = delegations[idx]

  if (delegation.status !== 'failed' && delegation.status !== 'cancelled') {
    return NextResponse.json(
      { error: `Retry nicht möglich — Status ist '${delegation.status}'` },
      { status: 400 },
    )
  }

  const plan = buildRetryPlan(delegation)
  if (!plan.shouldRetry) {
    return NextResponse.json(
      {
        error: plan.diagnosticMessage,
        retryCount: plan.retryCount,
        maxRetries: plan.maxRetries,
        failureCause: plan.failureCause,
      },
      { status: plan.maxRetriesReached ? 429 : 409 },
    )
  }

  const now = new Date().toISOString()
  const retryLog: AgentLog = {
    timestamp: now,
    type: 'info' as const,
    message: `🔁 Erneut eingereicht (Retry #${plan.retryCount + 1}) — ${plan.diagnosticMessage}`,
  }

  delegations[idx] = {
    ...delegation,
    status: 'pending',
    errorMessage: undefined,
    contract: {
      ...delegation.contract,
      context: plan.additionalContext,
    },
    logs: [...(delegation.logs ?? []), retryLog],
    updatedAt: now,
  }

  writeDelegationsAtomic(delegations)

  return NextResponse.json({
    retried: true,
    delegationId: id,
    retryCount: plan.retryCount + 1,
    failureCause: plan.failureCause,
    diagnosticMessage: plan.diagnosticMessage,
  })
}
