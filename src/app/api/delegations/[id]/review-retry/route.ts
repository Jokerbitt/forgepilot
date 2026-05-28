export const dynamic = 'force-dynamic'

/**
 * POST /api/delegations/[id]/review-retry
 *
 * Creates a new delegation from a completed one, injecting the quality-check
 * feedback as additional context. This closes the autonomous fix loop:
 * run → review → fix-with-context → run again.
 */

import { NextResponse } from 'next/server'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import { randomUUID } from 'crypto'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const delegation = await repo.findById(id)

  if (!delegation) {
    return NextResponse.json({ error: 'Delegation nicht gefunden' }, { status: 404 })
  }

  if (delegation.status !== 'completed') {
    return NextResponse.json(
      { error: 'Review-Retry ist nur für abgeschlossene Delegationen möglich' },
      { status: 409 },
    )
  }

  const qc = delegation.qualityCheck
  if (!qc || qc.verdict === 'passed') {
    return NextResponse.json(
      { error: 'Kein Review-Feedback vorhanden oder Delegation bereits bestanden' },
      { status: 409 },
    )
  }

  // Build review context block from failed criteria + suggestion
  const failedItems = qc.criteria.filter(c => !c.met)
  const reviewContext = [
    `## Review Feedback (Score: ${qc.overallScore}/100 — ${qc.verdict})`,
    '',
    failedItems.length > 0
      ? `### Nicht erfüllte Kriterien:\n${failedItems.map(c => `- **${c.item}**: ${c.notes}`).join('\n')}`
      : '',
    qc.suggestion ? `\n### Verbesserungshinweis:\n${qc.suggestion}` : '',
  ].filter(Boolean).join('\n')

  const now = new Date().toISOString()
  const parentContract = delegation.contract

  const newDelegation = await repo.create({
    title: `[Fix] ${delegation.title ?? parentContract.goal.slice(0, 60)}`,
    status: 'pending',
    executionRoute: delegation.executionRoute,
    costEstimateUsd: delegation.costEstimateUsd,
    targetRepo: delegation.targetRepo,
    tags: [...(delegation.tags ?? []), `review-retry-of:${id}`],
    chainedFromId: id,
    contract: {
      ...parentContract,
      id: randomUUID(),
      context: `${parentContract.context ?? ''}\n\n${reviewContext}`.trim(),
      createdAt: now,
    },
    createdAt: now,
    updatedAt: now,
  })

  // Log the retry on the original delegation
  await repo.update(id, {
    logs: [
      ...(delegation.logs ?? []),
      {
        timestamp: now,
        type: 'info' as const,
        message: `🔁 Review-Retry erstellt → Delegation ${newDelegation.id}`,
      },
    ],
  })

  return NextResponse.json({ delegationId: newDelegation.id }, { status: 201 })
}
