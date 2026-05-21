export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { embed, classify, summarize, compressContext } from '@/lib/ai/ollama-workloads'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { AIWorkloadSchema } from '@/lib/validation/schemas'

export async function POST(req: NextRequest) {
  const body = await parseBody(req, AIWorkloadSchema)
  if (isValidationError(body)) return body

  try {
    switch (body.workload) {
      case 'embed': {
        const result = await embed(body.text, body.model)
        return NextResponse.json(result)
      }
      case 'classify': {
        if (!body.labels?.length) {
          return NextResponse.json({ error: 'labels required for classify' }, { status: 400 })
        }
        const result = await classify(body.text, body.labels, body.model)
        return NextResponse.json(result)
      }
      case 'summarize': {
        const result = await summarize(body.text, body.maxSentences ?? 3, body.model)
        return NextResponse.json(result)
      }
      case 'compress': {
        const result = await compressContext(body.text, body.targetTokens ?? 500, body.model)
        return NextResponse.json(result)
      }
      default:
        return NextResponse.json({ error: 'Unknown workload' }, { status: 400 })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Workload failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
