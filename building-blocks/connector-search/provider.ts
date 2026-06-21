/**
 * Search connector — provider-agnostic full-text search over your documents.
 * Swap an in-memory index (dev / small data) for Meilisearch via env, same API.
 */

export interface SearchDocument {
  id: string
  /** Free text to index (concatenate the fields you want searchable). */
  text: string
  /** Optional structured fields returned with hits. */
  meta?: Record<string, string | number | boolean>
}

export interface SearchHit {
  id: string
  score: number
  meta?: Record<string, string | number | boolean>
}

export interface SearchProvider {
  readonly name: string
  /** Replace the index contents for a namespace (e.g. "tasks"). */
  index(namespace: string, docs: SearchDocument[]): Promise<void>
  /** Query a namespace; returns hits ranked by relevance. */
  search(namespace: string, query: string, limit?: number): Promise<SearchHit[]>
}

/** Tokenize text into lowercase word terms (shared by providers). */
export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
}
