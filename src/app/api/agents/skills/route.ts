export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { AGENT_PROFILES, getBestAgentForCategory } from '@/lib/agents/agent-skills'
import type { SkillCategory } from '@/lib/agents/agent-skills'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category') as SkillCategory | null

  if (category) {
    const best = getBestAgentForCategory(category)
    return NextResponse.json({ category, bestAgent: best, profile: AGENT_PROFILES[best] })
  }

  return NextResponse.json({ profiles: AGENT_PROFILES })
}
