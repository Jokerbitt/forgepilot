export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { z } from 'zod'

const ResumeSchema = z.object({
  decision: z.string().min(1).max(2000),
})

/**
 * POST /api/delegations/[id]/resume
 *
 * Resumes a delegation that was paused due to an ESCALATION.
 * Stores the user's decision and sets status back to 'approved'
 * so the next execute call picks it up as retryContext.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = await requireAuth()
  if (authError) return authError

  const { id } = await params
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)

  const delegation = await repo.findById(id)
  if (!delegation) {
    return NextResponse.json({ error: 'Delegation nicht gefunden' }, { status: 404 })
  }

  if (delegation.status !== 'pending') {
    return NextResponse.json(
      { error: `Delegation ist nicht in Wartestellung (Status: ${delegation.status})` },
      { status: 400 },
    )
  }

  const body = await parseBody(req, ResumeSchema)
  if (isValidationError(body)) return body

  await repo.update(id, {
    status: 'approved',
    escalationDecision: body.decision,
  })

  return NextResponse.json({ resumed: true, decision: body.decision })
}
