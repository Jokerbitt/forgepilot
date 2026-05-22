export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { getOpenAttentionItems } from '@/lib/attention/store'
import { buildDailyReport } from '@/lib/reports/daily-report'
import { readExecuteLoopEvidence } from '@/lib/reports/execute-loop-evidence-store'
import { createDelegationRepository, getDelegationStorageMode, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import { createKnowledgeCardRepository } from '@/lib/repositories/knowledgeCardRepository'
import { createProjectBriefRepository } from '@/lib/repositories/projectBriefRepository'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') ?? 'json'

  try {
    const delegationRepo = createDelegationRepository(SINGLE_TENANT_USER_ID)
    const projectBriefRepo = createProjectBriefRepository(SINGLE_TENANT_USER_ID)
    const knowledgeRepo = createKnowledgeCardRepository(SINGLE_TENANT_USER_ID)

    const [delegations, projectBriefs, knowledgeCards] = await Promise.all([
      delegationRepo.listByStatus(),
      projectBriefRepo.listAll(),
      knowledgeRepo.listAll(),
    ])

    const report = buildDailyReport({
      delegations,
      projectBriefs,
      knowledgeCards,
      attentionItems: getOpenAttentionItems(),
      storageMode: getDelegationStorageMode(process.env),
      authDisabled: process.env.FORGEPILOT_AUTH_DISABLED === 'true',
      executeLoopEvidence: readExecuteLoopEvidence(),
    })

    if (format === 'markdown') {
      return new NextResponse(report.markdown, {
        headers: {
          'content-type': 'text/markdown; charset=utf-8',
          'cache-control': 'no-store',
        },
      })
    }

    return NextResponse.json(report, {
      headers: { 'cache-control': 'no-store' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to build daily report: ${message}` }, { status: 500 })
  }
}
