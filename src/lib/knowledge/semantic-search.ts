/**
 * Semantic Search — M90
 *
 * Searches knowledge cards using pgvector when Supabase is available,
 * falling back to keyword search against the local JSON store.
 *
 * Usage:
 *   const results = await searchKnowledgeCards('authentication patterns', embedding)
 */

import { getSupabaseClient } from '@/lib/supabase/client'
import { getDataDir } from '@/lib/config/paths'
import fs from 'fs'
import path from 'path'

export interface SemanticSearchResult {
  id: string
  title: string
  body: string
  tags: string[]
  similarity: number  // 0-1; keyword fallback uses heuristic score
}

/**
 * Search knowledge cards.
 * When Supabase is available and an embedding is provided, uses pgvector.
 * Otherwise falls back to keyword matching in the local JSON store.
 */
export async function searchKnowledgeCards(
  query: string,
  embedding?: number[],
  threshold = 0.75,
  limit = 5,
): Promise<SemanticSearchResult[]> {
  const sb = getSupabaseClient()

  // ── Supabase path: semantic search via pgvector ───────────────────────────
  if (sb && embedding && embedding.length > 0) {
    const { data, error } = await sb.rpc('match_knowledge_cards', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: limit,
    })

    if (!error && Array.isArray(data)) {
      return (data as Array<{ id: string; title: string; body: string; tags: string[]; similarity: number }>)
        .map(r => ({ id: r.id, title: r.title, body: r.body, tags: r.tags, similarity: r.similarity }))
    }
  }

  // ── JSON fallback: keyword matching ───────────────────────────────────────
  return keywordSearch(query, limit)
}

function keywordSearch(query: string, limit: number): SemanticSearchResult[] {
  try {
    const storePath = path.join(getDataDir(), 'knowledge-store.json')
    if (!fs.existsSync(storePath)) return []

    const store = JSON.parse(fs.readFileSync(storePath, 'utf-8')) as {
      cards: Array<{ id: string; title: string; body: string; tags: string[]; type: string }>
    }

    const words  = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    if (words.length === 0) return []

    return store.cards
      .map(card => {
        const haystack = `${card.title} ${card.body} ${card.tags.join(' ')}`.toLowerCase()
        const hits     = words.filter(w => haystack.includes(w)).length
        const similarity = hits / words.length
        return { id: card.id, title: card.title, body: card.body, tags: card.tags, similarity }
      })
      .filter(r => r.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
  } catch {
    return []
  }
}

/**
 * Generate an embedding for a text using the provider registry.
 * Returns an empty array if no embedding-capable provider is configured.
 */
export async function generateKnowledgeEmbedding(
  text: string,
  providerId?: string,
): Promise<number[]> {
  try {
    const { getProviderInstance } = await import('@/lib/ai/providers/registry')
    const { getModelSelection, getAllProviderConfigs } = await import('@/lib/ai/providers/config-store')

    const sel = getModelSelection()
    const pid = providerId ?? sel.embeddingProvider ?? sel.fastProvider ?? 'ollama'

    const provider = getProviderInstance(pid)
    if (!provider || !provider.supportsEmbeddings || !provider.generateEmbedding) return []

    const configs = getAllProviderConfigs()
    const config  = configs.find(c => c.id === pid)
    const model   = config?.models.find(m => m.purpose === 'embedding')?.id ?? 'nomic-embed-text'

    // Resolve API key from env or stored keys
    let apiKey: string | undefined
    if (config?.apiKeyRef) {
      const { readStoredApiKeys } = await import('@/lib/connectors/config')
      const stored = readStoredApiKeys() as Record<string, string | undefined>
      apiKey = process.env[config.apiKeyRef] ?? stored[config.apiKeyRef]
    }

    const result = await provider.generateEmbedding(text, {
      system:    '',
      prompt:    text,
      maxTokens: 0,
      model,
      apiKey,
      baseUrl:   config?.baseUrl,
    })

    return result.embedding
  } catch {
    return []
  }
}
