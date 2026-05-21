export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createProjectBriefRepository } from '@/lib/repositories/projectBriefRepository'
import type { TaskContract } from '@/lib/models/delegation'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params

  const repo = createProjectBriefRepository()
  const brief = await repo.findById(id)

  if (!brief) {
    return NextResponse.json({ error: 'Brief nicht gefunden' }, { status: 404 })
  }

  if (brief.status !== 'accepted') {
    return NextResponse.json(
      { error: 'Brief muss freigegeben sein, bevor eine Delegation vorgeschlagen werden kann' },
      { status: 409 },
    )
  }

  // Build goal
  const goal = brief.desiredOutcome.trim() || brief.title

  // Build context from problemStatement + top 3 requirements + top 2 risks
  const contextParts: string[] = []
  if (brief.problemStatement.trim()) {
    contextParts.push(`Problem: ${brief.problemStatement}`)
  }
  const topRequirements = brief.requirements
    .filter(r => r.status !== 'rejected')
    .slice(0, 3)
  if (topRequirements.length > 0) {
    contextParts.push(
      `Requirements:\n${topRequirements.map(r => `- ${r.title}`).join('\n')}`,
    )
  }
  const topRisks = brief.risks.slice(0, 2)
  if (topRisks.length > 0) {
    contextParts.push(
      `Risiken:\n${topRisks.map(r => `- ${r.title}`).join('\n')}`,
    )
  }
  const context = contextParts.join('\n\n')

  // Build definitionOfDone from acceptanceCriteria or requirements
  const acceptedReqs = brief.requirements.filter(r => r.status === 'accepted')
  const definitionOfDone: string[] =
    acceptedReqs.length > 0
      ? acceptedReqs.map(r => r.title)
      : brief.requirements.map(r => r.title)

  // Risk class
  const riskClass: TaskContract['riskClass'] = brief.risks.length > 0 ? 'B' : 'A'

  const contract: Partial<TaskContract> = {
    id: randomUUID(),
    workItemId: `BRIEF-${brief.id.slice(0, 8).toUpperCase()}`,
    goal,
    context,
    taskType: 'feature',
    definitionOfDone,
    riskClass,
    maxBudgetUsd: 1,
    allowedTools: [],
    branchStrategy: 'feature',
    requiresApproval: riskClass !== 'A',
    privacyMode: 'local',
    createdAt: new Date().toISOString(),
  }

  return NextResponse.json({ contract })
}
