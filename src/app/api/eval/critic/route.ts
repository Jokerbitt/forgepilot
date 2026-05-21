/**
 * POST /api/eval/critic
 *
 * Sends delegation output to Grok for independent evaluation.
 * Returns a GrokCriticResult if xAI is configured, or 503 if not.
 *
 * Body: GrokCriticInput
 * Response: GrokCriticResult | { error: string }
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { runGrokCritic, runGrokCodeReview } from '@/lib/eval/grok-critic'

const CriticEvalSchema = z.object({
  type: z.literal('delegation'),
  delegationTitle: z.string().min(1),
  delegationContract: z.string().min(1),
  acceptanceCriteria: z.array(z.string()).min(1),
  agentOutput: z.string().min(1),
  filesChanged: z.array(z.string()).optional(),
})

const CodeReviewSchema = z.object({
  type: z.literal('code-review'),
  filePath: z.string().min(1),
  fileContent: z.string().min(1),
  diff: z.string().optional(),
  purpose: z.string().optional(),
})

const RequestSchema = z.discriminatedUnion('type', [CriticEvalSchema, CodeReviewSchema])

export async function POST(request: NextRequest) {
  const body = await parseBody(request, RequestSchema)
  if (isValidationError(body)) return body

  if (body.type === 'delegation') {
    const result = await runGrokCritic(body)
    if (!result) {
      return NextResponse.json(
        { error: 'Grok (xAI) is not configured. Add XAI_API_KEY in Settings → AI Providers.' },
        { status: 503 },
      )
    }
    return NextResponse.json(result)
  }

  // code-review
  const result = await runGrokCodeReview(body)
  if (!result) {
    return NextResponse.json(
      { error: 'Grok (xAI) is not configured. Add XAI_API_KEY in Settings → AI Providers.' },
      { status: 503 },
    )
  }
  return NextResponse.json(result)
}
