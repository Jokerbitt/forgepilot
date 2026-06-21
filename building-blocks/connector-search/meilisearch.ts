/**
 * Meilisearch provider via the HTTP API (no SDK). Fast typo-tolerant search.
 * Env: MEILI_HOST (e.g. http://localhost:7700), MEILI_KEY
 */
import type { SearchDocument, SearchHit, SearchProvider } from './provider'

export class MeilisearchProvider implements SearchProvider {
  readonly name = 'meilisearch'
  private host: string
  private key: string

  constructor(host = process.env.MEILI_HOST, key = process.env.MEILI_KEY) {
    if (!host) throw new Error('MEILI_HOST is not set')
    this.host = host.replace(/\/$/, '')
    this.key = key ?? ''
  }

  private headers(): Record<string, string> {
    return { 'Content-Type': 'application/json', ...(this.key ? { Authorization: `Bearer ${this.key}` } : {}) }
  }

  async index(namespace: string, docs: SearchDocument[]): Promise<void> {
    const documents = docs.map(d => ({ id: d.id, text: d.text, ...(d.meta ?? {}) }))
    await fetch(`${this.host}/indexes/${namespace}/documents`, {
      method: 'PUT', headers: this.headers(), body: JSON.stringify(documents),
    })
  }

  async search(namespace: string, query: string, limit = 20): Promise<SearchHit[]> {
    const res = await fetch(`${this.host}/indexes/${namespace}/search`, {
      method: 'POST', headers: this.headers(), body: JSON.stringify({ q: query, limit }),
    })
    const data = (await res.json()) as { hits?: Array<{ id: string; text?: string; [k: string]: unknown }> }
    return (data.hits ?? []).map((h, i) => {
      const { id, text: _t, ...meta } = h
      return { id, score: 1 - i / Math.max(1, (data.hits ?? []).length), meta: meta as SearchHit['meta'] }
    })
  }
}
