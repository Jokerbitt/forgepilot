export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getPerformanceSummaries, getDriftWarnings, seedDemoOutcomes } from '@/lib/agents/skill-evolver'

export async function GET() {
  // Auto-seed demo data when no real outcomes exist yet
  seedDemoOutcomes()
  const summaries = getPerformanceSummaries()
  const warnings = getDriftWarnings()

  const byAgent = summaries.reduce<Record<string, typeof summaries>>((acc, s) => {
    const key = s.agentType
    acc[key] = acc[key] ?? []
    acc[key].push(s)
    return acc
  }, {})

  return NextResponse.json({ summaries, byAgent, warnings })
}
