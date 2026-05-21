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
