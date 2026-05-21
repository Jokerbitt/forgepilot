export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { readProjectBriefs } from '@/lib/project-briefs'
import { readMilestones, readWorkPackages } from '@/lib/knowledge/milestone-store'
import { readStoredApiKeys } from '@/lib/connectors/config'
import { runPMAgent } from '@/lib/agent-runner/pm-agent'
import { readLastPMPlan, writePMPlan, isPlanStale } from '@/lib/agent-runner/pm-plan-store'
import { appendPMHistory } from '@/lib/agent-runner/pm-history-store'
import { getNBAConfig, saveNBAConfig } from '@/lib/nba-engine/nba-config'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'

export async function POST() {
  const config = getNBAConfig()

  // Check autoPmAgent toggle — if explicitly disabled, skip
  if (config.autoPmAgent === false) {
    const plan = readLastPMPlan()
    return NextResponse.json({ skipped: true, reason: 'autoPmAgent disabled', lastRunAt: plan?.runAt ?? null })
  }

  const plan = readLastPMPlan()

  if (!isPlanStale(plan)) {
    return NextResponse.json({ skipped: true, lastRunAt: plan!.runAt })
  }

  const storedKeys = readStoredApiKeys()
  const apiKey = storedKeys.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY nicht konfiguriert' }, { status: 422 })
  }

  const briefs = readProjectBriefs().filter(b => b.status !== 'archived')
  const milestones = readMilestones()
  const workPackages = readWorkPackages()
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const delegations = await repo.listByStatus()

  try {
    const result = await runPMAgent(briefs, milestones, workPackages, delegations, { apiKey })
    writePMPlan(result)
    appendPMHistory(result)
    return NextResponse.json({ ran: true, health: result.overallHealth })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function GET() {
  const plan = readLastPMPlan()
  const config = getNBAConfig()
  return NextResponse.json({
    lastRunAt: plan?.runAt ?? null,
    autoPmAgent: config.autoPmAgent ?? true,
    isStale: isPlanStale(plan),
  })
}

export async function PATCH(request: Request) {
  const body = await request.json() as { autoPmAgent: boolean }
  const config = getNBAConfig()
  saveNBAConfig({ ...config, autoPmAgent: body.autoPmAgent })
  return NextResponse.json({ ok: true, autoPmAgent: body.autoPmAgent })
}
