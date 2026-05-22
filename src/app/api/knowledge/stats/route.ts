export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCards, getSources } from '@/lib/knowledge/store'

export interface KnowledgeStats {
  cardCount: number
  sourceCount: number
  lastIndexedAt: string | null
  cardsByType: Record<string, number>
  nasAvailable: boolean
}

export async function GET() {
  const cards = getCards()
  const sources = getSources()

  const nasSources = sources.filter(s => s.type === 'nas')
  const lastIndexedAt =
    nasSources.length > 0
      ? nasSources
          .map(s => s.lastFetched)
          .sort()
          .at(-1) ?? null
      : null

  const cardsByType = cards.reduce<Record<string, number>>((acc, c) => {
    acc[c.type] = (acc[c.type] ?? 0) + 1
    return acc
  }, {})

  const nasAvailable = !!(
    process.env.FORGEPILOT_DOCS_DIR ||
    process.platform !== 'win32'
  )

  const stats: KnowledgeStats = {
    cardCount: cards.length,
    sourceCount: sources.length,
    lastIndexedAt,
    cardsByType,
    nasAvailable,
  }

  return NextResponse.json(stats)
}
