export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getAgents } from '@/lib/agents/registry'
import { getActiveClaims } from '@/lib/agents/scope-lock'
import { readDelegations } from '@/lib/delegations/queue'
import { buildAgentControlPlaneSummary } from '@/lib/agents/control-plane'

export async function GET() {
  return NextResponse.json(
    buildAgentControlPlaneSummary(
      getAgents(),
      getActiveClaims(),
      readDelegations(),
    ),
  )
}
