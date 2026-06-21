export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { z } from 'zod'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import type { Delegation } from '@/lib/models/delegation'

const FixFeedbackSchema = z.object({
  feedback: z.string().min(1, 'Feedback ist erforderlich').max(2000),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = await requireAuth()
  if (authError) return authError

  const { id } = await params
  const body = await parseBody(req, FixFeedbackSchema)
  if (isValidationError(body)) return body

  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const original = await repo.findById(id)
  if (!original) return NextResponse.json({ error: 'Delegation nicht gefunden' }, { status: 404 })

  if (original.status !== 'completed') {
    return NextResponse.json({ error: 'Nur abgeschlossene Delegationen können via Vorschau-Feedback verbessert werden' }, { status: 409 })
  }

  const workspacePath = original.worktreePath ?? 'Workspace nicht verfügbar'
  const prLink = original.summaryReport?.prUrl
    ? `\nPR: ${original.summaryReport.prUrl}`
    : ''

  const fixContext = [
    original.contract.context?.trim() ?? '',
    `\n## Vorschau-Feedback (M120)\n`,
    `**Problem beschrieben vom User:**\n${body.feedback}`,
    `\n**Workspace:**\n${workspacePath}${prLink}`,
    `\n**Ursprüngliche Delegation:**\n${original.title || original.contract.goal} (${id})`,
  ].filter(Boolean).join('\n')

  const fixTitle = `[Fix] ${original.title || original.contract.goal}`

  const newDelegation: Omit<Delegation, 'id' | 'createdAt' | 'updatedAt'> = {
    title: fixTitle,
    status: 'pending',
    executionRoute: original.executionRoute,
    costEstimateUsd: Math.min(original.costEstimateUsd ?? 1, 3),
    logs: [{
      timestamp: new Date().toISOString(),
      type: 'info',
      message: `Fix-Delegation aus Vorschau-Feedback erstellt. Ursprung: ${id}`,
    }],
    tags: [
      ...(original.tags ?? []).filter(t => !t.startsWith('preview-fix-of:')),
      `preview-fix-of:${id}`,
    ],
    chainedFromId: id,
    contract: {
      ...original.contract,
      goal: `Fix: ${original.contract.goal}`,
      context: fixContext,
      requiresApproval: true,
      definitionOfDone: [
        ...original.contract.definitionOfDone,
        `Das im Feedback beschriebene Problem ist behoben: "${body.feedback.slice(0, 100)}"`,
      ],
    },
    targetRepo: original.targetRepo,
  }

  const created = await repo.create(newDelegation as Delegation)

  // Log on the original delegation
  await repo.update(id, {
    logs: [
      ...(original.logs ?? []),
      {
        timestamp: new Date().toISOString(),
        type: 'info',
        message: `Vorschau-Feedback → Fix-Delegation erstellt: ${created.id}`,
      },
    ],
  })

  return NextResponse.json({ delegationId: created.id }, { status: 201 })
}
