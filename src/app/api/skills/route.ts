export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

import { listSkills, createSkill, seedBuiltinSkills, type SkillScope } from '@/lib/skills/prompt-skill-registry'
import { listSlashCommands } from '@/lib/skills/slash-command-manager'
import { summarizeOptimizations } from '@/lib/skills/skill-optimizer'

export async function GET() {
  seedBuiltinSkills()
  const promptSkills = listSkills()
  const slashCommands = listSlashCommands()
  const optimizationHint = summarizeOptimizations()
  return NextResponse.json({ promptSkills, slashCommands, optimizationHint })
}

export async function POST(request: Request) {
  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  // Validate required fields
  const { name, scope, content, description, tags } = body as Record<string, unknown>
  if (typeof name !== 'string' || typeof content !== 'string') {
    return NextResponse.json({ error: 'name and content required' }, { status: 400 })
  }
  const skill = createSkill({
    name,
    version: '1.0.0',
    scope: (typeof scope === 'string' ? scope : 'global') as SkillScope,
    status: 'draft',
    source: 'user',
    description: typeof description === 'string' ? description : name,
    content,
    isDynamic: content.includes('{{'),
    tags: Array.isArray(tags) ? tags.map(String) : [],
    metrics: { runsCount: 0, avgQualityScore: 0, avgTokensSaved: 0, successRate: 0, trend: 'unknown' },
    supersedes: [],
  })
  return NextResponse.json(skill, { status: 201 })
}
