export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { parseLinearWebhook, verifyLinearSignature } from '@/lib/linear/webhook-parser'
import type { LinearWebhookPayload } from '@/lib/linear/webhook-parser'
import type { Delegation, TaskContract } from '@/lib/models/delegation'
import { readDelegations } from '@/lib/delegations/queue'
import { apiLogger } from '@/lib/logger'
import fs from 'fs'
import path from 'path'

const DELEGATIONS_FILE = path.join(process.cwd(), 'config', 'delegations.json')

function writeDelegations(delegations: Delegation[]): void {
  const dir = path.dirname(DELEGATIONS_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = DELEGATIONS_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(delegations, null, 2), 'utf-8')
  fs.renameSync(tmp, DELEGATIONS_FILE)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text()
  const signature = request.headers.get('linear-signature')
  const secret = process.env.LINEAR_WEBHOOK_SECRET

  if (!verifyLinearSignature(rawBody, signature, secret)) {
    apiLogger.warn({ event: 'linear.webhook.invalid_signature' }, 'Linear webhook: invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: LinearWebhookPayload
  try {
    payload = JSON.parse(rawBody) as LinearWebhookPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = parseLinearWebhook(payload)

  if (result.action === 'ignore') {
    apiLogger.info({ event: 'linear.webhook.ignored', reason: result.reason }, 'Linear webhook ignored')
    return NextResponse.json({ ok: true, action: 'ignored', reason: result.reason })
  }

  const { candidate } = result
  const existing = readDelegations()
  const duplicate = existing.find(
    d => d.contract.workItemId === candidate.workItemId && d.status !== 'cancelled'
  )
  if (duplicate) {
    return NextResponse.json({
      ok: true, action: 'skipped',
      reason: `Delegation ${duplicate.id} already exists for ${candidate.workItemId}`,
      existingDelegationId: duplicate.id,
    })
  }

  const now = new Date().toISOString()
  const id = `del-linear-${candidate.workItemId.toLowerCase()}-${Date.now()}`

  const contract: TaskContract = {
    id, workItemId: candidate.workItemId,
    goal: candidate.goal, context: candidate.context,
    definitionOfDone: [
      `Issue ${candidate.workItemId} functionality is implemented`,
      'Tests added for new/changed behavior',
      'npm run type-check passes',
      'npm run test:run passes',
    ],
    riskClass: candidate.riskClass, maxBudgetUsd: candidate.maxBudgetUsd,
    allowedTools: ['read', 'write', 'bash', 'browser'],
    branchStrategy: candidate.branchStrategy, requiresApproval: candidate.requiresApproval,
    privacyMode: 'local', createdAt: now,
  }

  const delegation: Delegation = {
    id, title: candidate.title, contract,
    status: candidate.requiresApproval ? 'pending' : 'approved',
    executionRoute: 'runner', costEstimateUsd: candidate.maxBudgetUsd * 0.3,
    priority: 5 - candidate.priority, createdAt: now, updatedAt: now,
  }

  writeDelegations([...existing, delegation])
  apiLogger.info({ event: 'linear.webhook.delegation_created', workItemId: candidate.workItemId, delegationId: id }, `Auto-delegation created from ${candidate.workItemId}`)

  return NextResponse.json({
    ok: true, action: 'delegation-created', delegationId: id,
    status: delegation.status, workItemId: candidate.workItemId,
    riskClass: candidate.riskClass, requiresApproval: candidate.requiresApproval,
  }, { status: 201 })
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true, service: 'ForgePilot Linear Webhook' })
}
