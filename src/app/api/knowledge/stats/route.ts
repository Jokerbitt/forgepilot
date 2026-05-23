export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCards, getSources } from '@/lib/knowledge/store'
import { readKnowledgeCards } from '@/lib/knowledge/knowledge-card'
import { getIndexStatus } from '@/lib/knowledge/nas-indexer'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'

export interface KnowledgeStats {
  // MemoryCards (NAS-indexed)
  cardCount: number
  sourceCount: number
  cardsByType: Record<string, number>

  // KnowledgeCards (delegation lessons)
  delegationLessons: number

  // Context snapshots on delegations (M305)
  delegationsTotal: number
  delegationsWithSnapshot: number

  // Index freshness
  lastIndexedAt: string | null
  staleSources: number
  nasReachable: boolean
  secondbrainReachable: boolean

  /** @deprecated use nasReachable */
  nasAvailable: boolean
}

export async function GET() {
  const cards = getCards()
  const sources = getSources()

  const indexStatus = getIndexStatus()

  const cardsByType = cards.reduce<Record<string, number>>((acc, c) => {
    acc[c.type] = (acc[c.type] ?? 0) + 1
    return acc
  }, {})

  const lessons = readKnowledgeCards()

  // M305: count delegations that have a contextSnapshot
  let delegationsTotal = 0
  let delegationsWithSnapshot = 0
  try {
    const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
    const all = await repo.listByStatus()
    delegationsTotal = all.length
    delegationsWithSnapshot = all.filter(
      (d: import('@/lib/models/delegation').Delegation) =>
        d.contextSnapshot && d.contextSnapshot.cards.length > 0
    ).length
  } catch {
    // non-critical
  }

  const stats: KnowledgeStats = {
    cardCount: cards.length,
    sourceCount: sources.length,
    cardsByType,
    delegationLessons: lessons.length,
    delegationsTotal,
    delegationsWithSnapshot,
    lastIndexedAt: indexStatus.lastIndexedAt,
    staleSources: indexStatus.staleSources,
    nasReachable: indexStatus.nasReachable,
    secondbrainReachable: indexStatus.secondbrainReachable,
    nasAvailable: indexStatus.nasReachable,
  }

  return NextResponse.json(stats)
}
