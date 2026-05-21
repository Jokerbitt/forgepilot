/**
 * WorkItemRepository — Postgres storage layer for Work Items
 *
 * Uses the existing `workItems` table from the schema.
 * Maps DB rows to the domain WorkItem type from src/lib/models/work-item.ts.
 */

import { randomUUID } from 'crypto'
import { eq, desc, and, inArray } from 'drizzle-orm'
import { getDb } from '@/db/index'
import { workItems as workItemsTable } from '@/db/schema'
import type { WorkItem as DbWorkItemRow, NewWorkItem } from '@/db/schema'
import type { WorkItem, WorkItemStatus } from '@/lib/models/work-item'

// ─── Input types ──────────────────────────────────────────────────────────────

export interface CreateWorkItemInput {
  id?: string
  projectId?: string
  delegationId?: string
  source?: WorkItem['source']
  type?: WorkItem['type']
  title: string
  url?: string
  status?: WorkItemStatus
  priority?: 0 | 1 | 2 | 3 | 4
  blocked?: boolean
  blockedBy?: string[]
  risk?: WorkItem['risk']
  aiDelegable?: boolean
  estimatedMinutes?: number
  costEstimateUsd?: number
  labels?: string[]
  assigneeId?: string
  assigneeName?: string
  assigneeAvatarUrl?: string
  estimate?: number
  milestone?: string
  externalId?: string
}

export type UpdateWorkItemInput = Partial<CreateWorkItemInput>

// ─── Mapper ───────────────────────────────────────────────────────────────────

/**
 * Map a Postgres row to the domain WorkItem type.
 * The DB schema doesn't store `type`, `aiDelegable`, and a few other
 * domain fields — they live in `metadata` JSONB.
 */
function rowToWorkItem(row: DbWorkItemRow): WorkItem {
  const meta = row.metadata as Record<string, unknown>

  return {
    id:                row.id,
    source:            row.source as WorkItem['source'],
    type:              (meta['type'] as WorkItem['type']) ?? 'ticket',
    title:             row.title,
    url:               row.url,
    projectId:         row.projectId ?? '',
    milestone:         meta['milestone'] as string | undefined,
    status:            row.status as WorkItemStatus,
    priority:          (row.priority as 0 | 1 | 2 | 3 | 4),
    blocked:           row.blocked,
    blockedBy:         (row.blockedBy ?? []) as string[],
    risk:              row.riskClass as WorkItem['risk'],
    aiDelegable:       (meta['aiDelegable'] as boolean) ?? false,
    estimatedMinutes:  meta['estimatedMinutes'] as number | undefined,
    costEstimateUsd:   meta['costEstimateUsd'] as number | undefined,
    labels:            meta['labels'] as string[] | undefined,
    assigneeId:        meta['assigneeId'] as string | undefined,
    assigneeName:      meta['assigneeName'] as string | undefined,
    assigneeAvatarUrl: meta['assigneeAvatarUrl'] as string | undefined,
    estimate:          meta['estimate'] as number | undefined,
    updatedAt:         row.updatedAt.toISOString(),
    createdAt:         row.createdAt.toISOString(),
  }
}

function inputToNewRow(input: CreateWorkItemInput, userId: string): NewWorkItem {
  const now = new Date()
  const { type, aiDelegable, estimatedMinutes, costEstimateUsd, labels,
          assigneeId, assigneeName, assigneeAvatarUrl, estimate, milestone } = input

  return {
    id:           input.id ?? randomUUID(),
    userId,
    projectId:    input.projectId ?? null,
    delegationId: input.delegationId ?? null,
    source:       input.source ?? 'local',
    title:        input.title,
    status:       input.status ?? 'backlog',
    priority:     input.priority ?? 2,
    blocked:      input.blocked ?? false,
    blockedBy:    input.blockedBy ?? [],
    riskClass:    input.risk ?? 'B',
    url:          input.url ?? '',
    externalId:   input.externalId ?? null,
    metadata:     {
      type:              type ?? 'ticket',
      aiDelegable:       aiDelegable ?? false,
      estimatedMinutes,
      costEstimateUsd,
      labels,
      assigneeId,
      assigneeName,
      assigneeAvatarUrl,
      estimate,
      milestone,
    },
    createdAt: now,
    updatedAt: now,
  }
}

// ─── Repository ───────────────────────────────────────────────────────────────

export class WorkItemRepository {
  private readonly userId: string

  constructor(userId: string) {
    this.userId = userId
  }

  async create(input: CreateWorkItemInput): Promise<WorkItem> {
    const db = getDb()
    const row = inputToNewRow(input, this.userId)
    const [inserted] = await db.insert(workItemsTable).values(row).returning()
    if (!inserted) throw new Error('Postgres insert returned no row')
    return rowToWorkItem(inserted)
  }

  async findById(id: string): Promise<WorkItem | null> {
    const db = getDb()
    const [row] = await db
      .select()
      .from(workItemsTable)
      .where(and(
        eq(workItemsTable.id, id),
        eq(workItemsTable.userId, this.userId),
      ))
      .limit(1)

    return row ? rowToWorkItem(row) : null
  }

  async update(id: string, input: UpdateWorkItemInput): Promise<WorkItem | null> {
    const db = getDb()
    const now = new Date()

    // Fetch existing row to merge metadata
    const existing = await this.findById(id)
    if (!existing) return null

    const setValues: Partial<typeof workItemsTable.$inferInsert> = {
      updatedAt: now,
    }

    if (input.title       !== undefined) setValues.title    = input.title
    if (input.status      !== undefined) setValues.status   = input.status
    if (input.priority    !== undefined) setValues.priority = input.priority
    if (input.blocked     !== undefined) setValues.blocked  = input.blocked
    if (input.blockedBy   !== undefined) setValues.blockedBy = input.blockedBy
    if (input.risk        !== undefined) setValues.riskClass = input.risk
    if (input.url         !== undefined) setValues.url      = input.url
    if (input.source      !== undefined) setValues.source   = input.source
    if (input.projectId   !== undefined) setValues.projectId = input.projectId
    if (input.delegationId !== undefined) setValues.delegationId = input.delegationId
    if (input.externalId  !== undefined) setValues.externalId = input.externalId

    // Merge metadata fields
    const metaFields = [
      'type', 'aiDelegable', 'estimatedMinutes', 'costEstimateUsd',
      'labels', 'assigneeId', 'assigneeName', 'assigneeAvatarUrl', 'estimate', 'milestone',
    ] as const

    const hasMetaUpdate = metaFields.some(f => input[f as keyof UpdateWorkItemInput] !== undefined)
    if (hasMetaUpdate) {
      setValues.metadata = {
        type:              input.type              ?? existing.type,
        aiDelegable:       input.aiDelegable       ?? existing.aiDelegable,
        estimatedMinutes:  input.estimatedMinutes  ?? existing.estimatedMinutes,
        costEstimateUsd:   input.costEstimateUsd   ?? existing.costEstimateUsd,
        labels:            input.labels            ?? existing.labels,
        assigneeId:        input.assigneeId        ?? existing.assigneeId,
        assigneeName:      input.assigneeName      ?? existing.assigneeName,
        assigneeAvatarUrl: input.assigneeAvatarUrl ?? existing.assigneeAvatarUrl,
        estimate:          input.estimate          ?? existing.estimate,
        milestone:         input.milestone         ?? existing.milestone,
      }
    }

    const [updated] = await db
      .update(workItemsTable)
      .set(setValues)
      .where(and(
        eq(workItemsTable.id, id),
        eq(workItemsTable.userId, this.userId),
      ))
      .returning()

    return updated ? rowToWorkItem(updated) : null
  }

  async delete(id: string): Promise<boolean> {
    const db = getDb()
    const result = await db
      .delete(workItemsTable)
      .where(and(
        eq(workItemsTable.id, id),
        eq(workItemsTable.userId, this.userId),
      ))
      .returning({ id: workItemsTable.id })

    return result.length > 0
  }

  async listByUser(): Promise<WorkItem[]> {
    const db = getDb()
    const rows = await db
      .select()
      .from(workItemsTable)
      .where(eq(workItemsTable.userId, this.userId))
      .orderBy(desc(workItemsTable.updatedAt))

    return rows.map(rowToWorkItem)
  }

  async listByProject(projectId: string): Promise<WorkItem[]> {
    const db = getDb()
    const rows = await db
      .select()
      .from(workItemsTable)
      .where(and(
        eq(workItemsTable.userId, this.userId),
        eq(workItemsTable.projectId, projectId),
      ))
      .orderBy(desc(workItemsTable.updatedAt))

    return rows.map(rowToWorkItem)
  }

  async listByStatus(statuses: WorkItemStatus[]): Promise<WorkItem[]> {
    const db = getDb()
    const rows = await db
      .select()
      .from(workItemsTable)
      .where(and(
        eq(workItemsTable.userId, this.userId),
        inArray(workItemsTable.status, statuses),
      ))
      .orderBy(desc(workItemsTable.updatedAt))

    return rows.map(rowToWorkItem)
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createWorkItemRepository(userId: string): WorkItemRepository {
  return new WorkItemRepository(userId)
}
