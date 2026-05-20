export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { readPMHistory } from '@/lib/agent-runner/pm-history-store'

const DEFAULT_LIMIT = 5
const MAX_LIMIT = 10

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limitParam = searchParams.get('limit')
  const limit = limitParam
    ? Math.min(Math.max(1, parseInt(limitParam, 10) || DEFAULT_LIMIT), MAX_LIMIT)
    : DEFAULT_LIMIT

  const history = readPMHistory().slice(0, limit)
  return NextResponse.json(history)
}
