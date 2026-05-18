import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { KnowledgeStore, KnowledgeSource, KnowledgeItem, MemoryCard } from './types'

const DATA_DIR = join(process.cwd(), 'config')
const STORE_PATH = join(DATA_DIR, 'knowledge-store.json')

function emptyStore(): KnowledgeStore {
  return { sources: [], items: [], cards: [] }
}

export function readStore(): KnowledgeStore {
  if (!existsSync(STORE_PATH)) return emptyStore()
  try {
    return JSON.parse(readFileSync(STORE_PATH, 'utf-8')) as KnowledgeStore
  } catch {
    return emptyStore()
  }
}

function writeStore(store: KnowledgeStore): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8')
}

export function getSources(): KnowledgeSource[] {
  return readStore().sources
}

export function getSource(id: string): KnowledgeSource | undefined {
  return readStore().sources.find(s => s.id === id)
}

export function upsertSource(source: KnowledgeSource): KnowledgeSource {
  const store = readStore()
  const idx = store.sources.findIndex(s => s.id === source.id)
  if (idx >= 0) {
    store.sources[idx] = source
  } else {
    store.sources.push(source)
  }
  writeStore(store)
  return source
}

export function deleteSource(id: string): boolean {
  const store = readStore()
  const before = store.sources.length
  store.sources = store.sources.filter(s => s.id !== id)
  store.items = store.items.filter(i => i.sourceId !== id)
  writeStore(store)
  return store.sources.length < before
}

export function getItems(sourceId?: string): KnowledgeItem[] {
  const store = readStore()
  return sourceId ? store.items.filter(i => i.sourceId === sourceId) : store.items
}

export function upsertItem(item: KnowledgeItem): KnowledgeItem {
  const store = readStore()
  const idx = store.items.findIndex(i => i.id === item.id)
  if (idx >= 0) {
    store.items[idx] = item
  } else {
    store.items.push(item)
  }
  writeStore(store)
  return item
}

export function getCards(projectId?: string): MemoryCard[] {
  const store = readStore()
  return projectId ? store.cards.filter(c => c.projectId === projectId) : store.cards
}

export function getCard(id: string): MemoryCard | undefined {
  return readStore().cards.find(c => c.id === id)
}

export function upsertCard(card: MemoryCard): MemoryCard {
  const store = readStore()
  const idx = store.cards.findIndex(c => c.id === card.id)
  if (idx >= 0) {
    store.cards[idx] = card
  } else {
    store.cards.push(card)
  }
  writeStore(store)
  return card
}

export function deleteCard(id: string): boolean {
  const store = readStore()
  const before = store.cards.length
  store.cards = store.cards.filter(c => c.id !== id)
  writeStore(store)
  return store.cards.length < before
}

export function queryCards(opts: {
  projectId?: string
  tags?: string[]
  limit?: number
}): MemoryCard[] {
  let cards = getCards(opts.projectId)
  if (opts.tags?.length) {
    cards = cards.filter(c => opts.tags!.some(t => c.tags.includes(t)))
  }
  if (opts.limit) cards = cards.slice(0, opts.limit)
  return cards
}
