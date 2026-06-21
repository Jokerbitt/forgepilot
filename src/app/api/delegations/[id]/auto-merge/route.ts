export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { execFileSync } from 'child_process'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import { evaluateSafetyGates, type AutoMergeResponse } from '@/lib/delegations/auto-merge-gates'

/**
 * POST /api/delegations/[id]/auto-merge
 *
 * Merges the GitHub PR for a delegation only when all safety gates pass.
 * Uses `gh pr merge <prUrl> --squash --auto` to trigger GitHub's auto-merge.
 *
 * Response: { merged: boolean, gates: GateResult[], blockedBy?: string }
 */
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

  const { gates, blockedBy } = evaluateSafetyGates(delegation)

  if (blockedBy) {
    const response: AutoMergeResponse = { merged: false, gates, blockedBy }
    return NextResponse.json(response, { status: 422 })
  }

  // All gates passed — execute gh pr merge
  const prUrl = delegation.summaryReport!.prUrl!

  try {
    execFileSync(
      'gh',
      ['pr', 'merge', prUrl, '--squash', '--auto'],
      { encoding: 'utf-8', timeout: 30_000, stdio: 'pipe' },
    )
  } catch (err) {
    return NextResponse.json(
      { merged: false, gates, blockedBy: `gh pr merge fehlgeschlagen: ${String(err)}` } satisfies AutoMergeResponse,
      { status: 500 },
    )
  }

  // Update delegation: mark PR as merged
  await repo.update(id, {
    summaryReport: {
      keyPoints: delegation.summaryReport?.keyPoints ?? [],
      changes: delegation.summaryReport?.changes ?? [],
      timeTakenMinutes: delegation.summaryReport?.timeTakenMinutes ?? 0,
      ...delegation.summaryReport,
      prState: 'merged',
      prMergedAt: new Date().toISOString(),
    },
  })

  const response: AutoMergeResponse = { merged: true, gates }
  return NextResponse.json(response)
}
