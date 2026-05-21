import { randomUUID } from 'crypto'
import { eq, desc } from 'drizzle-orm'
import type { MemoryCard, MemoryCardType, ConfidenceLevel } from '@/lib/knowledge/types'
import { getCards, upsertCard, getCard, deleteCard } from '@/lib/knowledge/store'
import { isDatabaseConfigured, getDb } from '@/db/index'
import { knowledgeCards, type DbKnowledgeCard } from '@/db/schema'

export type CreateKnowledgeCardInput = Omit<MemoryCard, 'id' | 'createdAt' | 'updatedAt'> &
  Partial<Pick<MemoryCard, 'id' | 'createdAt' | 'updatedAt'>>

export interface KnowledgeCardRepository {
  /** Create a new knowledge card. */
  create(input: CreateKnowledgeCardInput): Promise<MemoryCard>
  /** Find a knowledge card by id. Returns null if not found. */
  findById(id: string): Promise<MemoryCard | null>
  /** List all knowledge cards. */
  listAll(): Promise<MemoryCard[]>
  /** List knowledge cards for a given delegation. */
  listByDelegation(delegationId: string): Promise<MemoryCard[]>
  /** List knowledge cards by type. */
  listByType(type: MemoryCardType): Promise<MemoryCard[]>
  /** Upsert by title+source — merges if card with same title and sourceId exists. */
  upsert(input: CreateKnowledgeCardInput): Promise<MemoryCard>
  /** Delete a knowledge card by id. */
  delete?(id: string): Promise<boolean>
}

// ─── Row → Domain mapper ─────────────────────────────────────────────────────

const DB_TYPE_TO_CARD_TYPE: Record<string, MemoryCardType> = {
  learning: 'learning',
  pattern: 'pattern',
  decision: 'decision',
  risk: 'risk',
  reference: 'context',
}

const CARD_TYPE_TO_DB: Record<MemoryCardType, 'learning' | 'pattern' | 'decision' | 'risk' | 'reference'> = {
  learning: 'learning',
  pattern: 'pattern',
  decision: 'decision',
  risk: 'risk',
  context: 'reference',
  requirement: 'reference',
}

const CONFIDENCE_MAP: Record<number, ConfidenceLevel> = {}

function numericToConfidence(value: number): ConfidenceLevel {
  if (value >= 0.8) return 'high'
  if (value >= 0.5) return 'medium'
  return 'low'
}

function confidenceToNumeric(level: ConfidenceLevel): number {
  if (level === 'high') return 0.9
  if (level === 'medium') return 0.65
  return 0.4
}

function rowToMemoryCard(row: DbKnowledgeCard): MemoryCard {
  return {
    id: row.id,
    type: (DB_TYPE_TO_CARD_TYPE[row.type] ?? 'learning') as MemoryCardType,
    title: row.title,
    body: row.body,
    sourceIds: row.delegationId ? [row.delegationId] : [],
    projectId: undefined,
    tags: (row.tags as string[]) ?? [],
    privacyClass: 'internal',
    confidence: numericToConfidence(row.confidence),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

// ─── Postgres implementation ─────────────────────────────────────────────────

class PostgresKnowledgeCardRepository implements KnowledgeCardRepository {
  async create(input: CreateKnowledgeCardInput): Promise<MemoryCard> {
    const db = getDb()
    const now = new Date()
    const id = input.id ?? randomUUID()
    const createdAt = input.createdAt ? new Date(input.createdAt) : now
    const updatedAt = input.updatedAt ? new Date(input.updatedAt) : now
    const delegationId = input.sourceIds?.[0] ?? null

    const dbType = CARD_TYPE_TO_DB[input.type] ?? 'learning'

    const rows = await db
      .insert(knowledgeCards)
      .values({
        id,
        type: dbType,
        title: input.title,
        body: input.body,
        source: null,
        delegationId,
        tags: input.tags ?? [],
        confidence: confidenceToNumeric(input.confidence),
        createdAt,
        updatedAt,
      })
      .returning()

    if (!rows[0]) throw new Error('Insert returned no rows')
    return rowToMemoryCard(rows[0])
  }

  async findById(id: string): Promise<MemoryCard | null> {
    const db = getDb()
    const rows = await db
      .select()
      .from(knowledgeCards)
      .where(eq(knowledgeCards.id, id))
      .limit(1)
    return rows[0] ? rowToMemoryCard(rows[0]) : null
  }

  async listAll(): Promise<MemoryCard[]> {
    const db = getDb()
    const rows = await db
      .select()
      .from(knowledgeCards)
      .orderBy(desc(knowledgeCards.createdAt))
    return rows.map(rowToMemoryCard)
  }

  async listByDelegation(delegationId: string): Promise<MemoryCard[]> {
    const db = getDb()
    const rows = await db
      .select()
      .from(knowledgeCards)
      .where(eq(knowledgeCards.delegationId, delegationId))
      .orderBy(desc(knowledgeCards.createdAt))
    return rows.map(rowToMemoryCard)
  }

  async listByType(type: MemoryCardType): Promise<MemoryCard[]> {
    const db = getDb()
    const dbType = CARD_TYPE_TO_DB[type] ?? 'learning'
    const rows = await db
      .select()
      .from(knowledgeCards)
      .where(eq(knowledgeCards.type, dbType))
      .orderBy(desc(knowledgeCards.createdAt))
    return rows.map(rowToMemoryCard)
  }

  async upsert(input: CreateKnowledgeCardInput): Promise<MemoryCard> {
    const db = getDb()
    const delegationId = input.sourceIds?.[0] ?? null
    const dbType = CARD_TYPE_TO_DB[input.type] ?? 'learning'

    // Try to find by id first (extraction uses `extraction:<delegationId>` as id)
    if (input.id) {
      const existing = await this.findById(input.id)
      if (existing) {
        const now = new Date()
        const rows = await db
          .update(knowledgeCards)
          .set({
            type: dbType,
            title: input.title,
            body: input.body,
            delegationId,
            tags: input.tags ?? [],
            confidence: confidenceToNumeric(input.confidence),
            updatedAt: now,
          })
          .where(eq(knowledgeCards.id, input.id))
          .returning()
        if (rows[0]) return rowToMemoryCard(rows[0])
      }
    }

    return this.create(input)
  }

  async delete(id: string): Promise<boolean> {
    const db = getDb()
    const rows = await db
      .delete(knowledgeCards)
      .where(eq(knowledgeCards.id, id))
      .returning({ id: knowledgeCards.id })
    return rows.length > 0
  }
}

// ─── JSON fallback implementation ────────────────────────────────────────────

class JsonKnowledgeCardRepository implements KnowledgeCardRepository {
  async create(input: CreateKnowledgeCardInput): Promise<MemoryCard> {
    const now = new Date().toISOString()
    const card: MemoryCard = {
      ...input,
      id: input.id ?? randomUUID(),
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    }
    upsertCard(card)
    return card
  }

  async findById(id: string): Promise<MemoryCard | null> {
    return getCard(id) ?? null
  }

  async listAll(): Promise<MemoryCard[]> {
    return getCards()
  }

  async listByDelegation(delegationId: string): Promise<MemoryCard[]> {
    const all = getCards()
    return all.filter(c => c.sourceIds.includes(delegationId) || c.tags.includes(`delegation:${delegationId}`))
  }

  async listByType(type: MemoryCardType): Promise<MemoryCard[]> {
    const all = getCards()
    return all.filter(c => c.type === type)
  }

  async upsert(input: CreateKnowledgeCardInput): Promise<MemoryCard> {
    const now = new Date().toISOString()
    const card: MemoryCard = {
      ...input,
      id: input.id ?? randomUUID(),
      createdAt: input.createdAt ?? now,
      updatedAt: now,
    }
    upsertCard(card)
    return card
  }

  async delete(id: string): Promise<boolean> {
    return deleteCard(id)
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createKnowledgeCardRepository(_userId?: string): KnowledgeCardRepository {
  if (isDatabaseConfigured()) {
    return new PostgresKnowledgeCardRepository()
  }
  return new JsonKnowledgeCardRepository()
}
