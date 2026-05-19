import { NextRequest, NextResponse } from 'next/server'
import { requestErasure, executeErasure, getErasureStatus } from '@/lib/dsgvo/erasure'

// GET /api/dsgvo/erasure?externalId=xxx — get erasure status
export async function GET(request: NextRequest) {
  const externalId = new URL(request.url).searchParams.get('externalId')
  if (!externalId) return NextResponse.json({ error: 'externalId required' }, { status: 400 })
  const status = await getErasureStatus(externalId)
  return NextResponse.json(status)
}

// POST /api/dsgvo/erasure — request or execute erasure
// Body: { externalId: string, execute?: boolean }
export async function POST(request: NextRequest) {
  const body       = await request.json() as { externalId?: string; execute?: boolean }
  const externalId = body.externalId

  if (!externalId) return NextResponse.json({ error: 'externalId required' }, { status: 400 })

  if (body.execute) {
    const result = await executeErasure(externalId)
    return NextResponse.json(result)
  }

  const subject = await requestErasure(externalId)
  return NextResponse.json(subject)
}
