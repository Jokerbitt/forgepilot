import { NextResponse } from 'next/server'
import type { DigestEntry } from '@/lib/models/attention'
import { getOpenAttentionItems } from '@/lib/attention/store'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import { createKnowledgeCardRepository } from '@/lib/repositories/knowledgeCardRepository'

export const dynamic = 'force-dynamic'

/** GET /api/digest — last-24h summary */
export async function GET() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  let allDelegations: Awaited<ReturnType<typeof repo.listByStatus>> = []
  try {
    allDelegations = await repo.listByStatus()
  } catch {
    // Non-critical — return zeros for delegation counts
  }
  const recent = allDelegations.filter(d => new Date(d.updatedAt || d.createdAt) >= since)

  const prsCreated: string[] = recent
    .filter(d => d.summaryReport?.prUrl)
    .map(d => d.summaryReport!.prUrl!)

  const totalCostUsd = recent
    .filter(d => d.actualCostUsd != null)
    .reduce((sum, d) => sum + (d.actualCostUsd ?? 0), 0)

  let newKnowledgeCards = 0
  try {
    const cardRepo = createKnowledgeCardRepository(SINGLE_TENANT_USER_ID)
    const allCards = await cardRepo.listAll()
    newKnowledgeCards = allCards.filter(c => new Date(c.createdAt) >= since).length
  } catch {
    // Non-critical — keep count at 0
  }

  const digest: DigestEntry = {
    delegationsCompleted: recent.filter(d => d.status === 'completed').length,
    delegationsFailed: recent.filter(d => d.status === 'failed').length,
    delegationsCancelled: recent.filter(d => d.status === 'cancelled').length,
    prsCreated,
    totalCostUsd,
    newKnowledgeCards,
    openAttentionItems: getOpenAttentionItems().length,
    generatedAt: new Date().toISOString(),
  }

  return NextResponse.json(digest)
}
