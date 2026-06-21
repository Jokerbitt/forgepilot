/**
 * In-memory TF-style full-text search — the zero-dep default.
 * Good for dev and modest datasets (a few thousand docs per namespace).
 * For large/production search, swap to the Meilisearch provider.
 */
import { tokenize, type SearchDocument, type SearchHit, type SearchProvider } from './provider'

interface IndexedDoc { id: string; terms: Map<string, number>; length: number; meta?: SearchDocument['meta'] }

export class MemorySearchProvider implements SearchProvider {
  readonly name = 'memory'
  private namespaces = new Map<string, IndexedDoc[]>()

  async index(namespace: string, docs: SearchDocument[]): Promise<void> {
    this.namespaces.set(namespace, docs.map(d => {
      const tokens = tokenize(d.text)
      const terms = new Map<string, number>()
      for (const t of tokens) terms.set(t, (terms.get(t) ?? 0) + 1)
      return { id: d.id, terms, length: Math.max(1, tokens.length), meta: d.meta }
    }))
  }

  async search(namespace: string, query: string, limit = 20): Promise<SearchHit[]> {
    const docs = this.namespaces.get(namespace) ?? []
    const queryTerms = tokenize(query)
    if (queryTerms.length === 0) return []
    // idf per query term + tf normalization → a small but real relevance score.
    const idf = new Map<string, number>()
    for (const qt of new Set(queryTerms)) {
      const df = docs.filter(d => d.terms.has(qt)).length
      idf.set(qt, df === 0 ? 0 : Math.log(1 + docs.length / df))
    }
    return docs
      .map(d => {
        let score = 0
        for (const qt of queryTerms) {
          const tf = (d.terms.get(qt) ?? 0) / d.length
          score += tf * (idf.get(qt) ?? 0)
        }
        return { id: d.id, score, meta: d.meta }
      })
      .filter(h => h.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }
}
