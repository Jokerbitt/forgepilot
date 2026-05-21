import { createKnowledgeCardRepository } from '@/lib/repositories/knowledgeCardRepository'
import { aiLogger } from '@/lib/logger'

export interface KnowledgeGraphLink {
  fromId: string
  toId: string
  relationship: 'related' | 'extends' | 'contradicts' | 'references'
}

/**
 * Get a card and all its related cards (1 level deep).
 * Used to expand context when building agent prompts.
 * Never throws — returns empty array on error.
 */
export async function getCardWithRelated(cardId: string): Promise<Array<{
  id: string
  title: string
  content: string
  relationship?: string
}>> {
  try {
    const repo = createKnowledgeCardRepository()
    const card = await repo.findById(cardId)
    if (!card) return []

    const results: Array<{ id: string; title: string; content: string; relationship?: string }> = [{
      id: card.id,
      title: card.title ?? '',
      content: card.body ?? '',
    }]

    const relatedIds = card.relatedCardIds ?? []
    if (relatedIds.length === 0) return results

    // Fetch related cards in parallel
    const related = await Promise.allSettled(
      relatedIds.map(id => repo.findById(id))
    )

    for (const r of related) {
      if (r.status === 'fulfilled' && r.value) {
        results.push({
          id: r.value.id,
          title: r.value.title ?? '',
          content: r.value.body ?? '',
          relationship: 'related',
        })
      }
    }

    return results
  } catch (error) {
    aiLogger.error(
      { event: 'knowledge.graph.error', cardId, error: error instanceof Error ? error.message : String(error) },
      'Failed to expand knowledge graph'
    )
    return []
  }
}

/**
 * Link two knowledge cards as related.
 * Bidirectional — both cards get each other in their relatedCardIds.
 */
export async function linkCards(
  fromId: string,
  toId: string
): Promise<{ success: boolean; reason?: string }> {
  try {
    const repo = createKnowledgeCardRepository()
    const [from, to] = await Promise.all([repo.findById(fromId), repo.findById(toId)])

    if (!from || !to) {
      return { success: false, reason: 'One or both cards not found' }
    }

    // Add bidirectional links
    const fromRelated = Array.from(new Set([...(from.relatedCardIds ?? []), toId]))
    const toRelated = Array.from(new Set([...(to.relatedCardIds ?? []), fromId]))

    await Promise.all([
      repo.upsert({ ...from, relatedCardIds: fromRelated }),
      repo.upsert({ ...to, relatedCardIds: toRelated }),
    ])

    aiLogger.info({ event: 'knowledge.graph.linked', fromId, toId }, 'Knowledge cards linked')
    return { success: true }
  } catch (error) {
    aiLogger.error(
      { event: 'knowledge.graph.link_error', error: error instanceof Error ? error.message : String(error) },
      'Failed to link cards'
    )
    return { success: false, reason: error instanceof Error ? error.message : 'unknown error' }
  }
}
