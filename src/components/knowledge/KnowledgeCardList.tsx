'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { KnowledgeCard } from '@/lib/knowledge/knowledge-card'

interface Props {
  delegationId: string
  /** compact=true: max 2 cards shown, link to full list */
  compact?: boolean
}

interface KnowledgeCardsResponse {
  cards: KnowledgeCard[]
  total: number
}

function excerpt(content: string, max = 200): string {
  const stripped = content.replace(/\*\*/g, '').replace(/^#+\s/gm, '')
  return stripped.length <= max ? stripped : stripped.slice(0, max).trimEnd() + '…'
}

export function KnowledgeCardList({ delegationId, compact = false }: Props) {
  const [cards, setCards] = useState<KnowledgeCard[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetch(`/api/knowledge-cards?sourceId=${encodeURIComponent(delegationId)}`)
      .then(r => r.json())
      .then((data: KnowledgeCardsResponse) => {
        setCards(data.cards ?? [])
      })
      .catch(() => {
        setFailed(true)
      })
      .finally(() => setLoading(false))
  }, [delegationId])

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-4 bg-gray-800 rounded animate-pulse w-3/4" />
        <div className="h-4 bg-gray-800 rounded animate-pulse w-1/2" />
      </div>
    )
  }

  // Fail-open: if fetch failed, render nothing (don't crash the page)
  if (failed) return null

  const visibleCards = compact ? cards.slice(0, 2) : cards
  const hasMore = compact && cards.length > 2

  if (visibleCards.length === 0) {
    if (compact) return null
    return (
      <p className="text-xs text-gray-500 italic">
        Für diese Delegation wurden noch keine Wissenskarten generiert.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {visibleCards.map(card => (
        <article
          key={card.id}
          className="rounded-lg border border-emerald-900/30 bg-emerald-950/10 px-4 py-3"
        >
          <h3 className="text-sm font-semibold text-emerald-300 leading-snug mb-1">
            {card.title}
          </h3>

          {card.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {card.tags.map(tag => (
                <span
                  key={tag}
                  className="px-1.5 py-0 text-[10px] rounded bg-gray-800 border border-gray-700 text-gray-500 font-mono"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-line">
            {excerpt(card.content)}
          </p>
        </article>
      ))}

      {hasMore && (
        <Link
          href="/knowledge-cards"
          className="block text-xs text-emerald-500 hover:text-emerald-400 transition-colors"
        >
          + {cards.length - 2} weitere Wissenskarten ansehen →
        </Link>
      )}
    </div>
  )
}
