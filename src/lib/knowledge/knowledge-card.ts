/**
 * knowledge-card.ts — M220: Lightweight KnowledgeCard store backed by config/knowledge-cards.json.
 *
 * Separate from the general MemoryCard store (knowledge-store.json) — these cards are
 * specifically written as post-execution lessons from delegation runs.
 */

import { randomUUID } from 'crypto'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

export interface KnowledgeCard {
  id: string
  title: string
  content: string   // Markdown
  source: 'delegation'
  sourceId: string  // delegationId
  briefId?: string
  prUrl?: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

interface KnowledgeCardStore {
  cards: KnowledgeCard[]
}

const MAX_CARDS = 500
const DATA_DIR = join(process.cwd(), 'config')
const STORE_PATH = join(DATA_DIR, 'knowledge-cards.json')

function emptyStore(): KnowledgeCardStore {
  return { cards: [] }
}

export function readKnowledgeCards(): KnowledgeCard[] {
  if (!existsSync(STORE_PATH)) return []
  try {
    const raw = JSON.parse(readFileSync(STORE_PATH, 'utf-8')) as KnowledgeCardStore
    return Array.isArray(raw.cards) ? raw.cards : []
  } catch {
    return []
  }
}

function persistStore(store: KnowledgeCardStore): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8')
}

/**
 * Write a new KnowledgeCard. Applies MAX_CARDS LRU eviction (oldest removed first).
 * Returns the persisted card with generated id, createdAt, updatedAt.
 */
export function writeKnowledgeCard(
  card: Omit<KnowledgeCard, 'id' | 'createdAt' | 'updatedAt'>,
): KnowledgeCard {
  const now = new Date().toISOString()
  const newCard: KnowledgeCard = {
    ...card,
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
  }

  const existing = readKnowledgeCards()
  const combined = [...existing, newCard]

  // Enforce cap — remove oldest entries when over limit
  const trimmed =
    combined.length > MAX_CARDS
      ? combined
          .slice()
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          .slice(combined.length - MAX_CARDS)
      : combined

  persistStore({ cards: trimmed })
  return newCard
}

/**
 * Return all cards whose sourceId matches the given value.
 */
export function findKnowledgeCardsBySource(sourceId: string): KnowledgeCard[] {
  return readKnowledgeCards().filter(c => c.sourceId === sourceId)
}

/**
 * Return a single card by id, or undefined if not found.
 */
export function findKnowledgeCardById(id: string): KnowledgeCard | undefined {
  return readKnowledgeCards().find(c => c.id === id)
}

/**
 * Delete a knowledge card by id.
 * Returns the deleted card, or undefined if no card with that id existed.
 */
export function deleteKnowledgeCard(id: string): KnowledgeCard | undefined {
  const cards = readKnowledgeCards()
  const index = cards.findIndex(c => c.id === id)
  if (index === -1) return undefined

  const [deleted] = cards.splice(index, 1)
  persistStore({ cards })
  return deleted
}

export type KnowledgeCardPatch = Partial<Pick<KnowledgeCard, 'title' | 'content' | 'tags' | 'prUrl'>>

/**
 * Patch an existing KnowledgeCard. Only `title`, `content`, `tags`, and `prUrl` are writable.
 * Updates `updatedAt` automatically. Returns the updated card, or undefined if not found.
 */
export function updateKnowledgeCard(id: string, patch: KnowledgeCardPatch): KnowledgeCard | undefined {
  const cards = readKnowledgeCards()
  const index = cards.findIndex(c => c.id === id)
  if (index === -1) return undefined

  const updated: KnowledgeCard = {
    ...cards[index],
    ...(patch.title   !== undefined && { title:   patch.title }),
    ...(patch.content !== undefined && { content: patch.content }),
    ...(patch.tags    !== undefined && { tags:    patch.tags }),
    ...(patch.prUrl   !== undefined && { prUrl:   patch.prUrl }),
    updatedAt: new Date().toISOString(),
  }
  cards[index] = updated
  persistStore({ cards })
  return updated
}

/**
 * Search knowledge cards by full-text query.
 * Matches against title, content, and tags (case-insensitive).
 * Returns cards sorted by relevance (title match first).
 */
export function searchKnowledgeCards(query: string): KnowledgeCard[] {
  if (!query.trim()) return readKnowledgeCards()
  const q = query.toLowerCase()
  return readKnowledgeCards()
    .map(card => {
      const titleMatch = card.title.toLowerCase().includes(q) ? 2 : 0
      const contentMatch = card.content.toLowerCase().includes(q) ? 1 : 0
      const tagMatch = card.tags.some(t => t.toLowerCase().includes(q)) ? 1 : 0
      return { card, score: titleMatch + contentMatch + tagMatch }
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(s => s.card)
}
