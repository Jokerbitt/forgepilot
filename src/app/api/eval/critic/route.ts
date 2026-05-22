/**
 * POST /api/eval/critic
 *
 * Sends delegation output to the configured critic chain for independent evaluation.
 * Returns a critic result if any configured provider works, or 503 if none do.
 *
 * Body: GrokCriticInput
 * Response: GrokCriticResult | { error: string }
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { getCriticProviderPlan, runGrokCritic, runGrokCodeReview } from '@/lib/eval/grok-critic'

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
        {
          error: 'No critic provider is available. Configure FORGEPILOT_CRITIC_PROVIDERS or keep auto mode with xAI/Grok, Claude/OpenAI/OpenRouter, Ollama, or LM Studio configured.',
          criticPlan: getCriticProviderPlan(),
        },
        { status: 503 },
      )
    }
    return NextResponse.json(result)
  }

  // code-review
  const result = await runGrokCodeReview(body)
  if (!result) {
    return NextResponse.json(
      {
        error: 'No critic provider is available. Configure FORGEPILOT_CRITIC_PROVIDERS or keep auto mode with xAI/Grok, Claude/OpenAI/OpenRouter, Ollama, or LM Studio configured.',
        criticPlan: getCriticProviderPlan(),
      },
      { status: 503 },
    )
  }
  return NextResponse.json(result)
}
