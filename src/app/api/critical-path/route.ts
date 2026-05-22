import { NextResponse } from 'next/server'
import { computeCriticalPath } from '@/lib/criticalPath'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const result = await computeCriticalPath()
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ issues: [], totalEstimate: 0, longestChain: 0 })
  }
}
