import { NextResponse } from 'next/server'
import { computeSkillProfiles } from '@/lib/agents/skill-profiles'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  try {
    const report = await computeSkillProfiles()
    return NextResponse.json(report)
  } catch {
    return NextResponse.json({ error: 'Failed to compute skill profiles' }, { status: 500 })
  }
}
