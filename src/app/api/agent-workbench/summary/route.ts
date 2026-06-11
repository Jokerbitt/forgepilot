export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { listRuns } from '@/lib/agents/orchestrated-run'
import { getAgents } from '@/lib/agents/registry'
import { buildAgentWorkbenchSummary } from '@/lib/agent-workbench/summary'
import {
  createDelegationRepository,
  SINGLE_TENANT_USER_ID,
} from '@/lib/repositories/delegationRepository'

export async function GET() {
  const delegationRepo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const delegations = await delegationRepo.listByStatus()

  return NextResponse.json(
    buildAgentWorkbenchSummary({
      agents: getAgents(),
      delegations,
      runs: listRuns(),
    }),
    { headers: { 'cache-control': 'no-store' } },
  )
}
