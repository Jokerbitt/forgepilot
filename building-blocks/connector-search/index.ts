/**
 * Search connector entrypoint — resolves a provider from env.
 *
 * SEARCH_PROVIDER = meilisearch | memory (default: meilisearch if MEILI_HOST, else memory)
 *
 * Usage:
 *   import { search } from '@/lib/search'
 *   await search().index('tasks', tasks.map(t => ({ id: t.id, text: `${t.title} ${t.description}`, meta: { projectId: t.projectId } })))
 *   const hits = await search().search('tasks', 'overdue invoice')
 */
import { MemorySearchProvider } from './memory-provider'
import type { SearchProvider } from './provider'

let cached: SearchProvider | null = null

export function search(env: NodeJS.ProcessEnv = process.env): SearchProvider {
  if (cached) return cached
  const choice = (env.SEARCH_PROVIDER ?? (env.MEILI_HOST ? 'meilisearch' : 'memory')).toLowerCase()
  if (choice === 'meilisearch') {
    const { MeilisearchProvider } = require('./meilisearch') as typeof import('./meilisearch')
    cached = new MeilisearchProvider()
  } else {
    cached = new MemorySearchProvider()
  }
  return cached
}

export function __resetSearch(): void { cached = null }

export { tokenize } from './provider'
export type { SearchDocument, SearchHit, SearchProvider } from './provider'
