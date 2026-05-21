import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { eq, inArray, desc } from 'drizzle-orm'
import type { Delegation, DelegationStatus } from '@/lib/models/delegation'
import { SINGLE_TENANT_USER_ID } from './base'
import { isDatabaseConfigured, getDb } from '@/db/index'
import { delegations, type DbDelegation } from '@/db/schema'

export { SINGLE_TENANT_USER_ID }

const DELEGATIONS_FILE = path.join(process.cwd(), 'config', 'delegations.json')
const STORAGE_MODE_ENV = 'FORGEPILOT_DELEGATION_STORAGE'

export type DelegationStorageMode = 'json' | 'postgres' | 'dual'

// ─── JSON helpers (fallback) ──────────────────────────────────────────────────

function readAll(): Delegation[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(DELEGATIONS_FILE, 'utf-8')) as unknown
    return Array.isArray(parsed) ? (parsed as Delegation[]) : []
  } catch {
    return []
  }
}

function writeAll(delegations: Delegation[]): void {
  const dir = path.dirname(DELEGATIONS_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = `${DELEGATIONS_FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(delegations, null, 2), 'utf-8')
  fs.renameSync(tmp, DELEGATIONS_FILE)
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreateDelegationInput = Omit<Delegation, 'id' | 'createdAt' | 'updatedAt'> &
  Partial<Pick<Delegation, 'id' | 'createdAt' | 'updatedAt'>>

export type UpdateDelegationInput = Partial<Omit<Delegation, 'id' | 'createdAt'>>

export interface DelegationRepository {
  /** Create a new delegation. Generates id/timestamps if not provided. */
  create(input: CreateDelegationInput): Promise<Delegation>
  /** Find a delegation by id. Returns null if not found. */
  findById(id: string): Promise<Delegation | null>
  /** Update fields on an existing delegation. Returns null if not found. */
  update(id: string, patch: UpdateDelegationInput): Promise<Delegation | null>
  /** Delete a delegation by id. Returns true if deleted, false if not found. */
  delete(id: string): Promise<boolean>
  /** List all delegations, optionally filtered by status. */
  listByStatus(statuses?: DelegationStatus[]): Promise<Delegation[]>
  /** List all delegations for a given project brief. */
  listByProject(briefId: string): Promise<Delegation[]>
}

// ─── Row → Domain mapper ─────────────────────────────────────────────────────

function rowToDelegation(row: DbDelegation): Delegation {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    executionRoute: row.executionRoute,
    costEstimateUsd: row.costEstimateUsd,
    actualCostUsd: row.actualCostUsd ?? undefined,
    agentRunId: row.agentRunId ?? undefined,
    traceId: row.traceId ?? undefined,
    errorMessage: row.errorMessage ?? undefined,
    failureFeedback: row.failureFeedback ?? undefined,
    note:
      row.note != null
        ? { text: row.note, updatedAt: row.updatedAt.toISOString() }
        : undefined,
    autoOrchestrate: row.autoOrchestrate,
    priority: row.priority ?? undefined,
    briefId: row.briefId ?? undefined,
    criticScore:
      row.criticScore != null
        ? (row.criticScore as unknown as Delegation['criticScore'])
        : undefined,
    contract: row.contract as unknown as Delegation['contract'],
    summaryReport:
      row.summaryReport != null
        ? (row.summaryReport as unknown as Delegation['summaryReport'])
        : undefined,
    logs:
      row.logs != null
        ? (row.logs as unknown as Delegation['logs'])
        : undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

// ─── Postgres implementation ─────────────────────────────────────────────────

class PostgresDelegationRepository implements DelegationRepository {
  async create(input: CreateDelegationInput): Promise<Delegation> {
    const db = getDb()
    const now = new Date()
    const id = input.id ?? randomUUID()
    const createdAt = input.createdAt ? new Date(input.createdAt) : now
    const updatedAt = input.updatedAt ? new Date(input.updatedAt) : now

    const rows = await db
      .insert(delegations)
      .values({
        id,
        title: input.title,
        status: input.status,
        riskClass: input.contract.riskClass as 'A' | 'B' | 'C',
        executionRoute: input.executionRoute,
        contract: input.contract as unknown as Record<string, unknown>,
        summaryReport:
          input.summaryReport != null
            ? (input.summaryReport as unknown as Record<string, unknown>)
            : null,
        logs:
          input.logs != null
            ? (input.logs as unknown as Array<Record<string, unknown>>)
            : [],
        costEstimateUsd: input.costEstimateUsd,
        actualCostUsd: input.actualCostUsd ?? null,
        traceId: input.traceId ?? null,
        agentRunId: input.agentRunId ?? null,
        errorMessage: input.errorMessage ?? null,
        failureFeedback: input.failureFeedback ?? null,
        note: input.note?.text ?? null,
        autoOrchestrate: input.autoOrchestrate ?? false,
        priority: input.priority ?? null,
        briefId: input.briefId ?? null,
        createdAt,
        updatedAt,
      })
      .returning()

    if (!rows[0]) throw new Error('Insert returned no rows')
    return rowToDelegation(rows[0])
  }

  async findById(id: string): Promise<Delegation | null> {
    const db = getDb()
    const rows = await db
      .select()
      .from(delegations)
      .where(eq(delegations.id, id))
      .limit(1)
    return rows[0] ? rowToDelegation(rows[0]) : null
  }

  async update(id: string, patch: UpdateDelegationInput): Promise<Delegation | null> {
    const db = getDb()

    const existing = await this.findById(id)
    if (!existing) return null

    const now = new Date()

    const rows = await db
      .update(delegations)
      .set({
        ...(patch.title != null ? { title: patch.title } : {}),
        ...(patch.status != null ? { status: patch.status } : {}),
        ...(patch.executionRoute != null ? { executionRoute: patch.executionRoute } : {}),
        ...(patch.contract != null
          ? {
              contract: patch.contract as unknown as Record<string, unknown>,
              riskClass: patch.contract.riskClass as 'A' | 'B' | 'C',
            }
          : {}),
        ...(patch.summaryReport !== undefined
          ? {
              summaryReport:
                patch.summaryReport != null
                  ? (patch.summaryReport as unknown as Record<string, unknown>)
                  : null,
            }
          : {}),
        ...(patch.logs !== undefined
          ? {
              logs:
                patch.logs != null
                  ? (patch.logs as unknown as Array<Record<string, unknown>>)
                  : [],
            }
          : {}),
        ...(patch.costEstimateUsd != null ? { costEstimateUsd: patch.costEstimateUsd } : {}),
        ...(patch.actualCostUsd !== undefined ? { actualCostUsd: patch.actualCostUsd ?? null } : {}),
        ...(patch.traceId !== undefined ? { traceId: patch.traceId ?? null } : {}),
        ...(patch.agentRunId !== undefined ? { agentRunId: patch.agentRunId ?? null } : {}),
        ...(patch.errorMessage !== undefined ? { errorMessage: patch.errorMessage ?? null } : {}),
        ...(patch.failureFeedback !== undefined
          ? { failureFeedback: patch.failureFeedback ?? null }
          : {}),
        ...(patch.note !== undefined ? { note: patch.note?.text ?? null } : {}),
        ...(patch.autoOrchestrate != null ? { autoOrchestrate: patch.autoOrchestrate } : {}),
        ...(patch.priority !== undefined ? { priority: patch.priority ?? null } : {}),
        ...(patch.briefId !== undefined ? { briefId: patch.briefId ?? null } : {}),
        ...(patch.criticScore !== undefined
          ? {
              criticScore:
                patch.criticScore != null
                  ? (patch.criticScore as unknown as Record<string, unknown>)
                  : null,
            }
          : {}),
        updatedAt: now,
      })
      .where(eq(delegations.id, id))
      .returning()

    return rows[0] ? rowToDelegation(rows[0]) : null
  }

  async delete(id: string): Promise<boolean> {
    const db = getDb()
    const rows = await db
      .delete(delegations)
      .where(eq(delegations.id, id))
      .returning({ id: delegations.id })
    return rows.length > 0
  }

  async listByStatus(statuses?: DelegationStatus[]): Promise<Delegation[]> {
    const db = getDb()
    const rows =
      !statuses || statuses.length === 0
        ? await db.select().from(delegations).orderBy(desc(delegations.createdAt))
        : await db
            .select()
            .from(delegations)
            .where(inArray(delegations.status, statuses))
            .orderBy(desc(delegations.createdAt))
    return rows.map(rowToDelegation)
  }

  async listByProject(briefId: string): Promise<Delegation[]> {
    const db = getDb()
    const rows = await db
      .select()
      .from(delegations)
      .where(eq(delegations.briefId, briefId))
      .orderBy(desc(delegations.createdAt))
    return rows.map(rowToDelegation)
  }
}

// ─── Dual-write migration implementation ────────────────────────────────────

class DualWriteDelegationRepository implements DelegationRepository {
  constructor(
    private readonly primary: DelegationRepository,
    private readonly replica: DelegationRepository
  ) {}

  async create(input: CreateDelegationInput): Promise<Delegation> {
    const created = await this.primary.create(input)
    await this.replica.create(created)
    return created
  }

  async findById(id: string): Promise<Delegation | null> {
    return this.primary.findById(id)
  }

  async update(id: string, patch: UpdateDelegationInput): Promise<Delegation | null> {
    const updated = await this.primary.update(id, patch)
    if (updated) {
      const replicated = await this.replica.update(id, updated)
      if (!replicated) {
        await this.replica.create(updated)
      }
    }
    return updated
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.primary.delete(id)
    if (deleted) {
      await this.replica.delete(id)
    }
    return deleted
  }

  async listByStatus(statuses?: DelegationStatus[]): Promise<Delegation[]> {
    return this.primary.listByStatus(statuses)
  }

  async listByProject(briefId: string): Promise<Delegation[]> {
    return this.primary.listByProject(briefId)
  }
}

// ─── JSON fallback implementation ────────────────────────────────────────────

class JsonDelegationRepository implements DelegationRepository {
  async create(input: CreateDelegationInput): Promise<Delegation> {
    const now = new Date().toISOString()
    const delegation: Delegation = {
      ...input,
      id: input.id ?? randomUUID(),
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    }
    const all = readAll()
    all.push(delegation)
    writeAll(all)
    return delegation
  }

  async findById(id: string): Promise<Delegation | null> {
    const all = readAll()
    return all.find((d) => d.id === id) ?? null
  }

  async update(id: string, patch: UpdateDelegationInput): Promise<Delegation | null> {
    const all = readAll()
    const idx = all.findIndex((d) => d.id === id)
    if (idx === -1) return null
    const updated: Delegation = {
      ...all[idx],
      ...patch,
      id,
      createdAt: all[idx].createdAt,
      updatedAt: new Date().toISOString(),
    }
    all[idx] = updated
    writeAll(all)
    return updated
  }

  async delete(id: string): Promise<boolean> {
    const all = readAll()
    const idx = all.findIndex((d) => d.id === id)
    if (idx === -1) return false
    all.splice(idx, 1)
    writeAll(all)
    return true
  }

  async listByStatus(statuses?: DelegationStatus[]): Promise<Delegation[]> {
    const all = readAll()
    if (!statuses || statuses.length === 0) return all
    const set = new Set<string>(statuses)
    return all.filter((d) => set.has(d.status))
  }

  async listByProject(briefId: string): Promise<Delegation[]> {
    const all = readAll()
    return all.filter((d) => d.briefId === briefId)
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function getDelegationStorageMode(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): DelegationStorageMode {
  const configured = String(env[STORAGE_MODE_ENV] ?? '').trim().toLowerCase()
  if (configured === 'json' || configured === 'postgres' || configured === 'dual') {
    return configured
  }
  return env.DATABASE_URL ? 'postgres' : 'json'
}

export function createDelegationRepository(_userId: string): DelegationRepository {
  const mode = getDelegationStorageMode()

  if (mode === 'dual') {
    if (!isDatabaseConfigured()) {
      throw new Error('DATABASE_URL is required when FORGEPILOT_DELEGATION_STORAGE=dual')
    }
    return new DualWriteDelegationRepository(
      new JsonDelegationRepository(),
      new PostgresDelegationRepository()
    )
  }

  if (mode === 'postgres') {
    if (!isDatabaseConfigured()) {
      throw new Error('DATABASE_URL is required when FORGEPILOT_DELEGATION_STORAGE=postgres')
    }
    return new PostgresDelegationRepository()
  }

  return new JsonDelegationRepository()
}
