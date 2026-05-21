export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import {
  buildProjectBrief,
  saveProjectBrief,
  updateProjectBrief,
  validateIdeaIntakeInput,
  hasIdeaIntakeErrors,
  splitConstraintLines,
} from '@/lib/project-briefs'
import type { IdeaIntakeInput } from '@/lib/models/project-brief'
import { verifyWebhookSignature } from '@/lib/webhooks/hmac'

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature =
    request.headers.get('x-forgepilot-signature') ??
    request.headers.get('x-hub-signature-256') // also support GitHub-style header

  const secret = process.env.INTAKE_WEBHOOK_SECRET
  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const typedBody = body as Record<string, unknown>

  const constraints = Array.isArray(typedBody.constraints)
    ? (typedBody.constraints as string[]).map(String)
    : typeof typedBody.constraints === 'string'
      ? splitConstraintLines(typedBody.constraints)
      : []

  const input: IdeaIntakeInput = {
    title:            String(typedBody.title ?? ''),
    rawIdea:          String(typedBody.rawIdea ?? typedBody.raw_idea ?? typedBody.idea ?? ''),
    problemStatement: String(typedBody.problemStatement ?? typedBody.problem_statement ?? typedBody.problem ?? ''),
    targetAudience:   String(typedBody.targetAudience ?? typedBody.target_audience ?? typedBody.audience ?? ''),
    desiredOutcome:   String(typedBody.desiredOutcome ?? typedBody.desired_outcome ?? typedBody.outcome ?? ''),
    scope:            (typedBody.scope as IdeaIntakeInput['scope']) ?? 'standard',
    researchMode:     (typedBody.researchMode ?? typedBody.research_mode) as IdeaIntakeInput['researchMode'] ?? 'standard',
    privacyMode:      (typedBody.privacyMode ?? typedBody.privacy_mode) as IdeaIntakeInput['privacyMode'] ?? 'local',
    constraints,
  }

  const errors = validateIdeaIntakeInput(input)
  if (hasIdeaIntakeErrors(errors)) {
    return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 422 })
  }

  const brief = buildProjectBrief(input)
  saveProjectBrief(brief)

  const autoDelegate = typedBody.autoDelegate === true || typedBody.auto_delegate === true
  if (!autoDelegate) {
    return NextResponse.json(brief, { status: 201 })
  }

  // Step 1: Accept the brief
  updateProjectBrief(brief.id, { status: 'accepted' })
  const acceptedBrief = { ...brief, status: 'accepted' as const }

  // Step 2: Create delegation
  const { createDelegationFromBrief } = await import('@/lib/delegation-creation')
  let delegation = await createDelegationFromBrief(acceptedBrief)

  const autoApprove = typedBody.autoApprove !== false && typedBody.auto_approve !== false // default true
  const autoExecute = typedBody.autoExecute === true || typedBody.auto_execute === true

  // Step 3: Auto-approve (if Risk A/B — never auto-approve Risk C)
  if (autoApprove && delegation.contract.riskClass !== 'C') {
    const { createDelegationRepository, SINGLE_TENANT_USER_ID } = await import('@/lib/repositories/delegationRepository')
    const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
    const log = {
      timestamp: new Date().toISOString(),
      type: 'success' as const,
      message: 'Delegation auto-approved via intake pipeline.',
    }
    delegation = await repo.update(delegation.id, {
      status: 'approved',
      approvalId: `intake-auto-${Date.now()}`,
      contract: { ...delegation.contract, requiresApproval: false },
      logs: [...(delegation.logs ?? []), log],
    }) ?? delegation
  }

  // Step 4: Trigger execution (fire-and-forget)
  if (autoExecute && delegation.status === 'approved') {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
    fetch(`${baseUrl}/api/delegations/${delegation.id}/execute`, { method: 'POST' })
      .catch(() => { /* non-critical — execution can be triggered manually */ })
  }

  return NextResponse.json(
    {
      brief: acceptedBrief,
      delegation,
      pipeline: {
        briefCreated: true,
        briefAccepted: true,
        delegationCreated: true,
        delegationApproved: autoApprove && delegation.status === 'approved',
        executionTriggered: autoExecute && delegation.status === 'approved',
      },
    },
    { status: 201 },
  )
}
