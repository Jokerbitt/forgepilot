'use client'

import { useEffect, useState } from 'react'
import type { KnowledgeCard } from '@/lib/knowledge/knowledge-card'

interface KnowledgeWritebackPanelProps {
  delegationId: string
}

interface KnowledgeCardsResponse {
  cards: KnowledgeCard[]
  total: number
}

export function KnowledgeWritebackPanel({ delegationId }: KnowledgeWritebackPanelProps) {
  const [cards, setCards] = useState<KnowledgeCard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/knowledge-cards?sourceId=${encodeURIComponent(delegationId)}`)
      .then(r => r.json())
      .then((data: KnowledgeCardsResponse) => {
        setCards(data.cards ?? [])
      })
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [delegationId])

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-gray-600" />
          Knowledge Writeback
        </h2>
        <div className="h-4 bg-gray-800 rounded animate-pulse w-48" />
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${cards.length > 0 ? 'bg-emerald-500' : 'bg-gray-600'}`} />
        Knowledge Writeback
        {cards.length > 0 && (
          <span className="ml-auto text-[10px] text-emerald-600 font-mono">{cards.length} Lektion{cards.length !== 1 ? 'en' : ''}</span>
        )}
      </h2>

      {cards.length === 0 ? (
        <p className="text-xs text-gray-600 italic">Noch kein Writeback — Lektionen werden nach Abschluss gespeichert.</p>
      ) : (
        <ul className="space-y-2">
          {cards.map(card => (
            <li key={card.id} className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-emerald-400">{card.title}</span>
              <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">{card.content}</p>
              {card.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {card.tags.map(tag => (
                    <span key={tag} className="px-1.5 py-0 text-[10px] rounded bg-gray-800 border border-gray-700 text-gray-500 font-mono">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
