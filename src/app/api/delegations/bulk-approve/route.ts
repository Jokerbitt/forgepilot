export const dynamic = 'force-dynamic'
/**
 * POST /api/delegations/bulk-approve
 *
 * Approves multiple pending delegations in one request.
 * Skips any that are not in 'pending' status or have riskClass 'C'.
 * Returns per-item results so callers know exactly what happened.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { AgentLog } from '@/lib/models/delegation'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import { parseBody } from '@/lib/validation/api'
import { logAuditEvent } from '@/lib/audit'

const BulkApproveSchema = z.object({
  ids:    z.array(z.string().min(1)).min(1, 'At least one id required').max(50),
  source: z.string().max(100).default('bulk-approve'),
  note:   z.string().max(500).optional(),
})

type ItemResult =
  | { id: string; ok: true }
  | { id: string; ok: false; reason: string }

export async function POST(request: Request) {
  const parsed = await parseBody(request, BulkApproveSchema)
  if (parsed instanceof NextResponse) return parsed

  const { ids, source, note } = parsed
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const results: ItemResult[] = []
  const now = new Date().toISOString()

  await Promise.all(
    ids.map(async (id) => {
      const delegation = await repo.findById(id)

      if (!delegation) {
        results.push({ id, ok: false, reason: 'not found' })
        return
      }
      if (delegation.status !== 'pending') {
        results.push({ id, ok: false, reason: `status is '${delegation.status}'` })
        return
      }
      if (delegation.contract.riskClass === 'C') {
        results.push({ id, ok: false, reason: 'riskClass C requires manual approval' })
        return
      }

      const noteText = note ? ` (${note})` : ''
      const log: AgentLog = {
        timestamp: now,
        type: 'success',
        message: `Delegation approved by ${source}${noteText}.`,
      }

      const updated = await repo.update(id, {
        status: 'approved',
        logs: [...(delegation.logs ?? []), log],
      })

      if (!updated) {
        results.push({ id, ok: false, reason: 'update failed' })
        return
      }

      logAuditEvent({
        action: 'delegation.approved',
        actor: source,
        entityId: id,
        entityType: 'delegation',
        entityTitle: delegation.title,
        metadata: { bulk: true, note },
      })

      results.push({ id, ok: true })
    }),
  )

  const approved = results.filter(r => r.ok)
  const skipped  = results.filter(r => !r.ok)

  return NextResponse.json({
    approved: approved.map(r => r.id),
    skipped:  skipped.map(r => ({ id: r.id, reason: (r as { id: string; ok: false; reason: string }).reason })),
    count:    approved.length,
  })
}
