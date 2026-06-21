export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { analyzeSkills, applyAutoOptimizations } from '@/lib/skills/skill-optimizer'

export async function POST(request: Request) {
  let body: unknown
  try { body = await request.json() } catch { body = {} }
  const { autoApply, confidenceThreshold } = (body ?? {}) as Record<string, unknown>

  const report = analyzeSkills()

  if (autoApply === true) {
    const threshold = typeof confidenceThreshold === 'number' ? confidenceThreshold : 85
    const result = applyAutoOptimizations(threshold)
    return NextResponse.json({ report, applied: result })
  }

  return NextResponse.json({ report })
}

export async function GET() {
  const report = analyzeSkills()
  return NextResponse.json(report)
}
