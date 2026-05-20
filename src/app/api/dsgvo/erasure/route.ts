export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { ErasureRequestSchema } from '@/lib/validation/schemas'
import { requestErasure, executeErasure, getErasureStatus } from '@/lib/dsgvo/erasure'
import { dsgvoLogger } from '@/lib/logger'
import { z } from 'zod'

const GetParamsSchema = z.object({ externalId: z.string().min(1) })

// GET /api/dsgvo/erasure?externalId=xxx — get erasure status
export async function GET(request: NextRequest) {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries())
  const parsed = GetParamsSchema.safeParse(params)

  if (!parsed.success) {
    return NextResponse.json({ error: 'externalId required' }, { status: 400 })
  }

  const status = await getErasureStatus(parsed.data.externalId)
  return NextResponse.json(status)
}

// POST /api/dsgvo/erasure — request or execute erasure
// Body: { externalId: string, execute?: boolean }
export async function POST(request: NextRequest) {
  const result = await parseBody(request, ErasureRequestSchema)
  if (isValidationError(result)) return result

  const { externalId, execute } = result

  if (execute) {
    dsgvoLogger.info({ event: 'dsgvo.erasure.execute', externalId })
    const erasureResult = await executeErasure(externalId)
    return NextResponse.json(erasureResult)
  }

  dsgvoLogger.info({ event: 'dsgvo.erasure.request', externalId })
  const subject = await requestErasure(externalId)
  return NextResponse.json(subject)
}
