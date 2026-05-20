export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { findProjectBriefById } from '@/lib/project-briefs'
import { getResearchDocument } from '@/lib/knowledge/research-store'
import { persistGeneratedPlan } from '@/lib/knowledge/milestone-store'
import { generateMilestones } from '@/lib/agent-runner/milestone-generator'
import { readStoredApiKeys } from '@/lib/connectors/config'

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const brief = findProjectBriefById(params.id)
  if (!brief) {
    return NextResponse.json({ error: 'Project brief not found' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({})) as { researchId?: string }
  const research = body.researchId ? getResearchDocument(body.researchId) : null

  const storedKeys = readStoredApiKeys()
  const apiKey = storedKeys.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY nicht konfiguriert' }, { status: 422 })
  }

  try {
    const { result, tokenUsage } = await generateMilestones(brief, { apiKey }, research)
    const plan = persistGeneratedPlan(brief.id, result.milestones, result.workPackages)

    return NextResponse.json({
      milestones: plan.milestones,
      workPackages: plan.workPackages,
      tokenUsage,
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
