export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { embed, classify, summarize, compressContext } from '@/lib/ai/ollama-workloads'

type WorkloadType = 'embed' | 'classify' | 'summarize' | 'compress'

interface WorkloadRequest {
  workload: WorkloadType
  text: string
  labels?: string[]
  targetTokens?: number
  maxSentences?: number
  model?: string
}

export async function POST(req: Request) {
  const body = await req.json() as Partial<WorkloadRequest>

  if (!body.workload || !body.text) {
    return NextResponse.json({ error: 'workload and text required' }, { status: 400 })
  }

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
