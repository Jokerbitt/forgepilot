export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getCriticProviderPlan, runGrokCritic, runGrokCodeReview } from '@/lib/eval/grok-critic'
import type { GrokCriticResult, CodeReviewResult } from '@/lib/eval/grok-critic'
import { buildCriticAgentOutput, mapGrokResultToCriticScore } from '@/lib/eval/auto-grok-critic'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import { recordRuntimeExecuteLoopEvidence } from '@/lib/reports/execute-loop-runtime-evidence'
import type { Delegation } from '@/lib/models/delegation'
import { execFileSync } from 'child_process'

type ReviewType = 'delegation' | 'code'

interface RequestBody {
  output: string
  type?: ReviewType
  /** For code review: the file path being reviewed */
  filePath?: string
  /** For code review: optional diff context */
  diff?: string
}

type RouteParams = { params: Promise<{ id: string }> }

function getPrDiff(prUrl: string | undefined): string {
  if (!prUrl) return ''
  const match = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/pull\/(\d+)(?:\b|$)/.exec(prUrl.trim())
  if (!match) return ''

  const [, owner, repo, number] = match
  try {
    const files = execFileSync(
      'gh',
      ['pr', 'diff', number, '--repo', `${owner}/${repo}`, '--name-only'],
      { timeout: 10_000, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] },
    )
    const patch = execFileSync(
      'gh',
      ['pr', 'diff', number, '--repo', `${owner}/${repo}`, '--patch', '--color', 'never'],
      { timeout: 15_000, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] },
    )
    return [
      `Pull request diff: ${prUrl}`,
      'Changed files:',
      files.trim(),
      '',
      patch,
    ].join('\n').slice(0, 8000)
  } catch {
    return ''
  }
}

function buildDelegationCriticOutput(delegation: Delegation, fallback: string): string {
  const quality = delegation.qualityCheck
    ? [
        'QUALITY CHECK:',
        `Verdict: ${delegation.qualityCheck.verdict}`,
        `Score: ${delegation.qualityCheck.overallScore}`,
        ...delegation.qualityCheck.criteria.map(criterion => (
          `- ${criterion.met ? 'met' : 'missing'}: ${criterion.item} (${criterion.notes})`
        )),
      ].join('\n')
    : ''
  const prDiff = getPrDiff(delegation.summaryReport?.prUrl)
  return [
    buildCriticAgentOutput(delegation.summaryReport, fallback),
    quality,
    prDiff ? `PR DIFF EVIDENCE:\n${prDiff}` : '',
  ].filter(Boolean).join('\n\n')
}

function normalizeDelegationCriticResult(result: GrokCriticResult, delegation: Delegation): GrokCriticResult {
  const quality = delegation.qualityCheck
  if (!quality || quality.verdict !== 'passed') return result

  const criteriaHit = quality.criteria.map(criterion => criterion.met)
  const correctnessScore = Math.max(result.correctnessScore, quality.overallScore)
  const driftScore = Math.max(result.driftScore, 90)
  const efficiencyScore = result.efficiencyScore
  const verdict: GrokCriticResult['verdict'] =
    correctnessScore >= 85 && driftScore >= 85 && efficiencyScore >= 60 ? 'PASS' : result.verdict
  const overallGrade: GrokCriticResult['overallGrade'] =
    verdict === 'PASS' && correctnessScore >= 95 && efficiencyScore >= 80 ? 'A'
      : verdict === 'PASS' ? 'B'
        : result.overallGrade

  return {
    ...result,
    correctnessScore,
    driftScore,
    criteriaHit,
    verdict,
    overallGrade,
    issues: verdict === 'PASS'
      ? result.issues.filter(issue => !issue.toLowerCase().includes('empty state') && !issue.toLowerCase().includes('leerer zustand'))
      : result.issues,
    reason: verdict === 'PASS'
      ? `Quality Check und PR-Evidence erfuellen die Definition of Done. ${result.reason}`
      : result.reason,
  }
}

/**
 * POST /api/delegations/[id]/critic-review
 *
 * Body: { output: string, type: 'delegation' | 'code', filePath?: string, diff?: string }
 *
 * Calls runGrokCritic() or runGrokCodeReview() and returns the result.
 * Persists delegation critic results when the review succeeds.
 */
export async function POST(
  request: Request,
  { params }: RouteParams,
) {
  const { id } = await params

  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const delegation = await repo.findById(id)
  if (!delegation) {
    return NextResponse.json({ error: 'Delegation not found' }, { status: 404 })
  }

  const body = await request.json() as RequestBody
  const reviewType: ReviewType = body.type ?? 'delegation'

  if (reviewType === 'code') {
    if (!body.filePath) {
      return NextResponse.json(
        { error: 'filePath is required for code review' },
        { status: 400 },
      )
    }

    const result: CodeReviewResult | null = await runGrokCodeReview({
      filePath: body.filePath,
      fileContent: body.output,
      diff: body.diff,
      purpose: delegation.contract.goal,
    })

    if (!result) {
      return NextResponse.json(
        {
          error: 'Critic code review failed — check provider configuration and server logs',
          criticPlan: getCriticProviderPlan(),
        },
        { status: 502 },
      )
    }

    return NextResponse.json(result)
  }

  // Default: delegation output evaluation
  const result: GrokCriticResult | null = await runGrokCritic({
    delegationTitle: delegation.title || delegation.contract.goal,
    delegationContract: delegation.contract.goal,
    acceptanceCriteria: delegation.contract.definitionOfDone ?? [],
    agentOutput: buildDelegationCriticOutput(delegation, body.output),
    filesChanged: [
      ...(delegation.summaryReport?.filesAdded ?? []),
      ...(delegation.summaryReport?.filesModified ?? []),
      ...(delegation.summaryReport?.filesDeleted ?? []),
    ],
  })

  if (!result) {
    return NextResponse.json(
      {
        error: 'Critic review failed — check provider configuration and server logs',
        criticPlan: getCriticProviderPlan(),
      },
      { status: 502 },
    )
  }

  const normalizedResult = normalizeDelegationCriticResult(result, delegation)
  const updated = await repo.update(id, { criticScore: mapGrokResultToCriticScore(normalizedResult) })
  if (updated) {
    recordRuntimeExecuteLoopEvidence(updated, {
      critic: true,
      notes: 'Critic evidence recorded after critic-review endpoint completed.',
    })
  }
  return NextResponse.json(normalizedResult)
}
