export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getAgents } from '@/lib/agents/registry'
import { getActiveClaims } from '@/lib/agents/scope-lock'
import { readDelegations } from '@/lib/delegations/queue'
import { buildAgentControlPlaneSummary } from '@/lib/agents/control-plane'
import { isPlanStale, readLastPMPlan } from '@/lib/agent-runner/pm-plan-store'

export async function GET() {
  const pmPlan = readLastPMPlan()
  return NextResponse.json(
    buildAgentControlPlaneSummary(
      getAgents(),
      getActiveClaims(),
      readDelegations(),
      pmPlan,
      isPlanStale(pmPlan),
    ),
  )
}
