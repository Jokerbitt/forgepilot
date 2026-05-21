/**
 * DelegationRepository — Dual-Write storage layer for Delegations
 *
 * Bridges the existing JSON store (config/delegations.json) and the new
 * Postgres backend. Migration phase is controlled by POSTGRES_MODE env var.
 *
 * Read src/lib/repositories/base.ts for the full migration phase docs.
 */

import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { eq, desc, and, inArray } from 'drizzle-orm'
import { getDb, isDatabaseConfigured } from '@/db/index'
import { delegations as delegationsTable } from '@/db/schema'
import type { NewDelegation } from '@/db/schema'
import {
  BaseRepository,
  getPostgresMode,
  shouldWriteToPostgres,
  type PostgresMode,
} from './base'
import type { Delegation, DelegationStatus } from '@/lib/models/delegation'

// ─── JSON store ───────────────────────────────────────────────────────────────

const DELEGATIONS_FILE = path.join(process.cwd(), 'config', 'delegations.json')

function readJsonStore(): Delegation[] {
  try {
    return JSON.parse(fs.readFileSync(DELEGATIONS_FILE, 'utf-8')) as Delegation[]
  } catch {
    return []
  }
}

function writeJsonStore(delegations: Delegation[]): void {
  const dir = path.dirname(DELEGATIONS_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  // Atomic write via tmp file + rename to prevent corruption on crash
  const tmp = `${DELEGATIONS_FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(delegations, null, 2), 'utf-8')
  fs.renameSync(tmp, DELEGATIONS_FILE)
}

// ─── Input/Output types ───────────────────────────────────────────────────────

export interface CreateDelegationInput {
  title: string
  contract: Delegation['contract']
  status?: DelegationStatus
  executionRoute?: Delegation['executionRoute']
  costEstimateUsd?: number
  autoOrchestrate?: boolean
  priority?: number
  briefId?: string
  /** Override generated ID (used during backfill to preserve existing IDs) */
  id?: string
}

export type UpdateDelegationInput = Partial<
  Pick<
    Delegation,
    | 'title'
    | 'status'
    | 'executionRoute'
    | 'costEstimateUsd'
    | 'actualCostUsd'
    | 'agentRunId'
    | 'summaryReport'
    | 'logs'
    | 'errorMessage'
    | 'failureFeedback'
    | 'note'
    | 'traceId'
    | 'autoOrchestrate'
    | 'priority'
  >
>

// ─── Postgres ↔ Domain model mappers ─────────────────────────────────────────

/**
 * Map a Postgres row to the domain Delegation type.
 * Keep this co-located with the repository — it's the only place that
 * knows about both the DB row shape and the domain type.
 */
function rowToDelegation(row: typeof delegationsTable.$inferSelect): Delegation {
  return {
    id:              row.id,
    title:           row.title,
    status:          row.status,
    executionRoute:  row.executionRoute,
    costEstimateUsd: row.costEstimateUsd,
    actualCostUsd:   row.actualCostUsd ?? undefined,
    agentRunId:      row.agentRunId ?? undefined,
    traceId:         row.traceId ?? undefined,
    errorMessage:    row.errorMessage ?? undefined,
    failureFeedback: row.failureFeedback ?? undefined,
    note:            row.note ? { text: row.note, updatedAt: row.updatedAt.toISOString() } : undefined,
    autoOrchestrate: row.autoOrchestrate,
    priority:        row.priority ?? undefined,
    briefId:         row.briefId ?? undefined,
    contract:        row.contract as unknown as Delegation['contract'],
    summaryReport:   row.summaryReport as unknown as Delegation['summaryReport'] ?? undefined,
    logs:            (row.logs ?? []) as unknown as Delegation['logs'],
    createdAt:       row.createdAt.toISOString(),
    updatedAt:       row.updatedAt.toISOString(),
  }
}

/**
 * Map a CreateDelegationInput to a Drizzle insert row.
 * Requires a userId — repositories are always user-scoped.
 */
function inputToNewRow(
  input: CreateDelegationInput,
  userId: string,
): NewDelegation {
  const now = new Date()
  return {
    id:              input.id ?? randomUUID(),
    userId,
    title:           input.title,
    status:          input.status ?? 'pending',
    riskClass:       input.contract.riskClass ?? 'B',
    executionRoute:  input.executionRoute ?? 'manual',
    contract:        input.contract as unknown as Record<string, unknown>,
    costEstimateUsd: input.costEstimateUsd ?? 0,
    autoOrchestrate: input.autoOrchestrate ?? false,
    priority:        input.priority ?? null,
    briefId:         input.briefId ?? null,
    logs:            [],
    createdAt:       now,
    updatedAt:       now,
  }
}

// ─── Repository ───────────────────────────────────────────────────────────────

export class DelegationRepository extends BaseRepository<
  Delegation,
  CreateDelegationInput,
  UpdateDelegationInput
> {
  /** userId used for all operations — repositories are always user-scoped */
  private readonly userId: string

  constructor(userId: string, mode: PostgresMode = getPostgresMode()) {
    super(mode)
    this.userId = userId
  }

  // ─── JSON implementations ─────────────────────────────────────────────────

  protected async createInJson(input: CreateDelegationInput): Promise<Delegation> {
    const all = readJsonStore()
    const id = input.id ?? randomUUID()
    const now = new Date().toISOString()

    const delegation: Delegation = {
      id,
      title: input.title,
      status: input.status ?? 'pending',
      executionRoute: input.executionRoute ?? 'manual',
      costEstimateUsd: input.costEstimateUsd ?? 0,
      autoOrchestrate: input.autoOrchestrate ?? false,
      priority: input.priority,
      briefId: input.briefId,
      contract: input.contract,
      createdAt: now,
      updatedAt: now,
    }

    all.push(delegation)
    writeJsonStore(all)
    return delegation
  }

  protected async findByIdFromJson(id: string): Promise<Delegation | null> {
    return readJsonStore().find(d => d.id === id) ?? null
  }

  protected async updateInJson(id: string, input: UpdateDelegationInput): Promise<Delegation | null> {
    const all = readJsonStore()
    const idx = all.findIndex(d => d.id === id)
    if (idx === -1) return null

    const updated: Delegation = {
      ...all[idx]!,
      ...input,
      note: input.note !== undefined
        ? { text: String(input.note), updatedAt: new Date().toISOString() }
        : all[idx]!.note,
      updatedAt: new Date().toISOString(),
    }

    all[idx] = updated
    writeJsonStore(all)
    return updated
  }

  protected async deleteFromJson(id: string): Promise<boolean> {
    const all = readJsonStore()
    const next = all.filter(d => d.id !== id)
    if (next.length === all.length) return false
    writeJsonStore(next)
    return true
  }

  // ─── Postgres implementations ─────────────────────────────────────────────

  protected async createInPostgres(input: CreateDelegationInput): Promise<Delegation> {
    const db = getDb()
    const row = inputToNewRow(input, this.userId)
    const [inserted] = await db.insert(delegationsTable).values(row).returning()
    if (!inserted) throw new Error('Postgres insert returned no row')
    return rowToDelegation(inserted)
  }

  protected async findByIdFromPostgres(id: string): Promise<Delegation | null> {
    const db = getDb()
    const [row] = await db
      .select()
      .from(delegationsTable)
      .where(and(
        eq(delegationsTable.id, id),
        eq(delegationsTable.userId, this.userId),
      ))
      .limit(1)

    return row ? rowToDelegation(row) : null
  }

  protected async updateInPostgres(id: string, input: UpdateDelegationInput): Promise<Delegation | null> {
    const db = getDb()

    const setValues: Partial<typeof delegationsTable.$inferInsert> = {
      updatedAt: new Date(),
    }

    if (input.title         !== undefined) setValues.title          = input.title
    if (input.status        !== undefined) setValues.status         = input.status
    if (input.executionRoute !== undefined) setValues.executionRoute = input.executionRoute
    if (input.costEstimateUsd !== undefined) setValues.costEstimateUsd = input.costEstimateUsd
    if (input.actualCostUsd !== undefined) setValues.actualCostUsd  = input.actualCostUsd
    if (input.agentRunId    !== undefined) setValues.agentRunId     = input.agentRunId
    if (input.traceId       !== undefined) setValues.traceId        = input.traceId
    if (input.errorMessage  !== undefined) setValues.errorMessage   = input.errorMessage
    if (input.failureFeedback !== undefined) setValues.failureFeedback = input.failureFeedback
    if (input.autoOrchestrate !== undefined) setValues.autoOrchestrate = input.autoOrchestrate
    if (input.priority      !== undefined) setValues.priority       = input.priority
    if (input.summaryReport !== undefined) setValues.summaryReport  = input.summaryReport as unknown as Record<string, unknown>
    if (input.logs          !== undefined) setValues.logs           = input.logs as unknown as Array<Record<string, unknown>>
    if (input.note          !== undefined) setValues.note           = typeof input.note === 'string' ? input.note : (input.note as { text: string } | undefined)?.text ?? null

    const [updated] = await db
      .update(delegationsTable)
      .set(setValues)
      .where(and(
        eq(delegationsTable.id, id),
        eq(delegationsTable.userId, this.userId),
      ))
      .returning()

    return updated ? rowToDelegation(updated) : null
  }

  protected async deleteFromPostgres(id: string): Promise<boolean> {
    const db = getDb()
    const result = await db
      .delete(delegationsTable)
      .where(and(
        eq(delegationsTable.id, id),
        eq(delegationsTable.userId, this.userId),
      ))
      .returning({ id: delegationsTable.id })

    return result.length > 0
  }

  // ─── Additional queries not in base ──────────────────────────────────────

  /**
   * List delegations for a project, sorted by createdAt desc.
   * Respects POSTGRES_MODE for read routing.
   */
  async listByProject(projectId: string): Promise<Delegation[]> {
    if (this.mode === 'read' || this.mode === 'postgres') {
      return this.listByProjectFromPostgres(projectId)
    }
    return this.listByProjectFromJson(projectId)
  }

  /**
   * List all delegations for this user, optionally filtered by status.
   */
  async listByStatus(statuses?: DelegationStatus[]): Promise<Delegation[]> {
    if (this.mode === 'read' || this.mode === 'postgres') {
      return this.listByStatusFromPostgres(statuses)
    }
    return this.listByStatusFromJson(statuses)
  }

  // ─── JSON list implementations ────────────────────────────────────────────

  private listByProjectFromJson(projectId: string): Promise<Delegation[]> {
    const all = readJsonStore()
    return Promise.resolve(
      all
        .filter(d => d.contract.workItemId === projectId || (d as unknown as Record<string, string>)['projectId'] === projectId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    )
  }

  private listByStatusFromJson(statuses?: DelegationStatus[]): Promise<Delegation[]> {
    const all = readJsonStore()
    return Promise.resolve(
      statuses
        ? all.filter(d => statuses.includes(d.status)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        : all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    )
  }

  // ─── Postgres list implementations ───────────────────────────────────────

  private async listByProjectFromPostgres(projectId: string): Promise<Delegation[]> {
    const db = getDb()
    const rows = await db
      .select()
      .from(delegationsTable)
      .where(and(
        eq(delegationsTable.userId, this.userId),
        eq(delegationsTable.projectId, projectId),
      ))
      .orderBy(desc(delegationsTable.createdAt))

    return rows.map(rowToDelegation)
  }

  private async listByStatusFromPostgres(statuses?: DelegationStatus[]): Promise<Delegation[]> {
    const db = getDb()

    const rows = statuses?.length
      ? await db
          .select()
          .from(delegationsTable)
          .where(and(
            eq(delegationsTable.userId, this.userId),
            inArray(delegationsTable.status, statuses),
          ))
          .orderBy(desc(delegationsTable.createdAt))
      : await db
          .select()
          .from(delegationsTable)
          .where(eq(delegationsTable.userId, this.userId))
          .orderBy(desc(delegationsTable.createdAt))

    return rows.map(rowToDelegation)
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a DelegationRepository for the given user.
 *
 * Pass `userId` from the session or use SINGLE_TENANT_USER_ID for
 * single-tenant NAS deployments.
 *
 * @example
 *   const repo = createDelegationRepository(session.user.id)
 *   const delegation = await repo.create({ title: '...', contract: {...} })
 */
export function createDelegationRepository(
  userId: string,
  mode?: PostgresMode,
): DelegationRepository {
  return new DelegationRepository(userId, mode ?? getPostgresMode())
}

/**
 * Convenience: create a repository configured for Postgres-only reads/writes.
 * Used in the backfill script and migration tooling.
 */
export function createPostgresOnlyRepository(userId: string): DelegationRepository {
  if (!isDatabaseConfigured()) {
    throw new Error('DATABASE_URL is required for Postgres-only repository')
  }
  return new DelegationRepository(userId, 'postgres')
}

/** Single-tenant default user ID — replace with real session user ID for multi-tenant */
export const SINGLE_TENANT_USER_ID = process.env.FORGEPILOT_SINGLE_TENANT_USER_ID ?? 'single-user-owner'
