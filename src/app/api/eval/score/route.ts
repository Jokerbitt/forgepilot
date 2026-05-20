export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import {
  scoreOutput,
  saveEvalResult,
  detectRegression,
  getEvalCase,
  type EvalResult,
} from '@/lib/eval/harness'
import crypto from 'crypto'

interface ScoreBody {
  caseId: string
  agentOutput: string
  tokensUsed?: number
  costUsd?: number
  filesChangedOutsideScope?: number
  totalFilesChanged?: number
  delegationId?: string
  runId?: string
  promptVariant?: string
  providerId?: string
  modelId?: string
}

/**
 * POST /api/eval/score
 *
 * Score an agent's output against eval case criteria.
 * Saves result, checks for regression, returns grade + alert if any.
 */
export async function POST(request: NextRequest) {
  const body = await request.json() as ScoreBody

  const evalCase = getEvalCase(body.caseId)
  if (!evalCase) {
    return NextResponse.json({ error: `Eval case not found: ${body.caseId}` }, { status: 404 })
  }

  const scored = scoreOutput({
    criteria:                  evalCase.acceptanceCriteria,
    agentOutput:               body.agentOutput,
    tokensUsed:                body.tokensUsed,
    costUsd:                   body.costUsd,
    filesChangedOutsideScope:  body.filesChangedOutsideScope,
    totalFilesChanged:         body.totalFilesChanged,
  })

  const regressionAlert = detectRegression(body.caseId, scored.grade)

  const result: EvalResult = {
    id:               `result-${crypto.randomUUID()}`,
    caseId:           body.caseId,
    delegationId:     body.delegationId,
    runId:            body.runId,
    correctnessScore: scored.correctnessScore,
    efficiencyScore:  scored.efficiencyScore,
    driftScore:       scored.driftScore,
    overallGrade:     scored.grade,
    criteriaHit:      scored.criteriaHit,
    tokensUsed:       body.tokensUsed,
    costUsd:          body.costUsd,
    regression:       regressionAlert !== null,
    promptVariant:    body.promptVariant,
    providerId:       body.providerId,
    modelId:          body.modelId,
    evaluatedAt:      new Date().toISOString(),
  }

  await saveEvalResult(result)

  return NextResponse.json({
    result,
    regression: regressionAlert,
  })
}
