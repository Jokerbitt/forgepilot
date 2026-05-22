export const dynamic = 'force-dynamic'

import { readKnowledgeCards } from '@/lib/knowledge/knowledge-card'
import { KnowledgeCardsClientPage } from './KnowledgeCardsClientPage'

export default function KnowledgeCardsPage() {
  const cards = readKnowledgeCards().sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt),
  )

  return <KnowledgeCardsClientPage cards={cards} />
}
