export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { selectBestRoute } from '@/lib/agents/route-selector'

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { goal?: string }
    const goal = body.goal ?? ''
    const suggestion = await selectBestRoute(goal)
    return NextResponse.json(suggestion)
  } catch {
    return NextResponse.json({ error: 'Failed to suggest route' }, { status: 500 })
  }
}
