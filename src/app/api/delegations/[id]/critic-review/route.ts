export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { Delegation } from '@/lib/models/delegation'
import { runGrokCritic, runGrokCodeReview } from '@/lib/eval/grok-critic'
import type { GrokCriticResult, CodeReviewResult } from '@/lib/eval/grok-critic'

const DELEGATIONS_FILE = path.join(process.cwd(), 'config', 'delegations.json')

function readDelegations(): Delegation[] {
  try {
    return JSON.parse(fs.readFileSync(DELEGATIONS_FILE, 'utf-8')) as Delegation[]
  } catch {
    return []
  }
}

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

/**
 * POST /api/delegations/[id]/critic-review
 *
 * Body: { output: string, type: 'delegation' | 'code', filePath?: string, diff?: string }
 *
 * Calls runGrokCritic() or runGrokCodeReview() and returns the result.
 * Returns 503 if XAI_API_KEY is not configured.
 */
export async function POST(
  request: Request,
  { params }: RouteParams,
) {
  const { id } = await params

  if (!process.env.XAI_API_KEY) {
    return NextResponse.json(
      {
        error: 'Grok not configured',
        hint: 'Add XAI_API_KEY to .env.local to enable Grok Critic review',
      },
      { status: 503 },
    )
  }

  const delegation = readDelegations().find(d => d.id === id)
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
        { error: 'Grok code review failed — check server logs' },
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
    agentOutput: body.output,
    filesChanged: delegation.summaryReport?.filesModified ?? delegation.summaryReport?.filesAdded,
  })

  if (!result) {
    return NextResponse.json(
      { error: 'Grok critic review failed — check server logs' },
      { status: 502 },
    )
  }

  return NextResponse.json(result)
}
