/**
 * ProjectBriefRepository — Postgres storage layer for Project Briefs
 *
 * The domain ProjectBrief type is complex and evolves quickly, so the full
 * object is stored in the `data` JSONB column. Top-level columns (id, title,
 * status, scope, researchMode, privacyMode, createdAt, updatedAt) exist for
 * filtering and sorting without deserializing the full JSONB payload.
 */

import { randomUUID } from 'crypto'
import { eq, desc, and } from 'drizzle-orm'
import { getDb } from '@/db/index'
import { projectBriefs as projectBriefsTable } from '@/db/schema'
import type { DbProjectBrief, NewProjectBrief } from '@/db/schema'
import type { ProjectBrief, ProjectBriefStatus } from '@/lib/models/project-brief'

// ─── Input/Output types ───────────────────────────────────────────────────────

export interface CreateProjectBriefInput {
  id?: string
  title: string
  status?: ProjectBriefStatus
  scope?: string
  researchMode?: string
  privacyMode?: string
  data: ProjectBrief
}

export type UpdateProjectBriefInput = Partial<{
  title: string
  status: ProjectBriefStatus
  scope: string
  researchMode: string
  privacyMode: string
  data: ProjectBrief
}>

// ─── Mapper ───────────────────────────────────────────────────────────────────

/**
 * Map a Postgres row back to the domain ProjectBrief type.
 * The full object lives in `data`; we trust it was stored correctly.
 */
function rowToProjectBrief(row: DbProjectBrief): ProjectBrief {
  const data = row.data as unknown as ProjectBrief
  return {
    ...data,
    // Ensure top-level DB columns are authoritative for indexed fields
    id:          row.id,
    title:       row.title,
    status:      row.status as ProjectBriefStatus,
    scope:       row.scope as ProjectBrief['scope'],
    researchMode: row.researchMode as ProjectBrief['researchMode'],
    privacyMode: row.privacyMode as ProjectBrief['privacyMode'],
    createdAt:   row.createdAt.toISOString(),
    updatedAt:   row.updatedAt.toISOString(),
  }
}

/**
 * Build a NewProjectBrief insert row from domain input.
 */
function inputToNewRow(input: CreateProjectBriefInput, userId: string): NewProjectBrief {
  const now = new Date()
  const id = input.id ?? randomUUID()
  const brief: ProjectBrief = {
    ...input.data,
    id,
    title:       input.title,
    status:      input.status ?? 'draft',
    scope:       (input.scope as ProjectBrief['scope']) ?? 'standard',
    researchMode: (input.researchMode as ProjectBrief['researchMode']) ?? 'standard',
    privacyMode: (input.privacyMode as ProjectBrief['privacyMode']) ?? 'local',
    createdAt:   now.toISOString(),
    updatedAt:   now.toISOString(),
  }

  return {
    id,
    userId,
    title:        input.title,
    status:       input.status ?? 'draft',
    scope:        input.scope ?? 'standard',
    researchMode: input.researchMode ?? 'standard',
    privacyMode:  input.privacyMode ?? 'local',
    data:         brief as unknown as Record<string, unknown>,
    createdAt:    now,
    updatedAt:    now,
  }
}

// ─── Repository ───────────────────────────────────────────────────────────────

export class ProjectBriefRepository {
  private readonly userId: string

  constructor(userId: string) {
    this.userId = userId
  }

  async create(input: CreateProjectBriefInput): Promise<ProjectBrief> {
    const db = getDb()
    const row = inputToNewRow(input, this.userId)
    const [inserted] = await db.insert(projectBriefsTable).values(row).returning()
    if (!inserted) throw new Error('Postgres insert returned no row')
    return rowToProjectBrief(inserted)
  }

  async findById(id: string): Promise<ProjectBrief | null> {
    const db = getDb()
    const [row] = await db
      .select()
      .from(projectBriefsTable)
      .where(and(
        eq(projectBriefsTable.id, id),
        eq(projectBriefsTable.userId, this.userId),
      ))
      .limit(1)

    return row ? rowToProjectBrief(row) : null
  }

  async update(id: string, input: UpdateProjectBriefInput): Promise<ProjectBrief | null> {
    const db = getDb()
    const now = new Date()

    const setValues: Partial<typeof projectBriefsTable.$inferInsert> = {
      updatedAt: now,
    }

    if (input.title        !== undefined) setValues.title        = input.title
    if (input.status       !== undefined) setValues.status       = input.status
    if (input.scope        !== undefined) setValues.scope        = input.scope
    if (input.researchMode !== undefined) setValues.researchMode = input.researchMode
    if (input.privacyMode  !== undefined) setValues.privacyMode  = input.privacyMode
    if (input.data         !== undefined) {
      setValues.data = {
        ...input.data,
        updatedAt: now.toISOString(),
      } as unknown as Record<string, unknown>
    }

    const [updated] = await db
      .update(projectBriefsTable)
      .set(setValues)
      .where(and(
        eq(projectBriefsTable.id, id),
        eq(projectBriefsTable.userId, this.userId),
      ))
      .returning()

    return updated ? rowToProjectBrief(updated) : null
  }

  async delete(id: string): Promise<boolean> {
    const db = getDb()
    const result = await db
      .delete(projectBriefsTable)
      .where(and(
        eq(projectBriefsTable.id, id),
        eq(projectBriefsTable.userId, this.userId),
      ))
      .returning({ id: projectBriefsTable.id })

    return result.length > 0
  }

  async listByUser(): Promise<ProjectBrief[]> {
    const db = getDb()
    const rows = await db
      .select()
      .from(projectBriefsTable)
      .where(eq(projectBriefsTable.userId, this.userId))
      .orderBy(desc(projectBriefsTable.updatedAt))

    return rows.map(rowToProjectBrief)
  }

  async listByStatus(status: ProjectBriefStatus): Promise<ProjectBrief[]> {
    const db = getDb()
    const rows = await db
      .select()
      .from(projectBriefsTable)
      .where(and(
        eq(projectBriefsTable.userId, this.userId),
        eq(projectBriefsTable.status, status),
      ))
      .orderBy(desc(projectBriefsTable.updatedAt))

    return rows.map(rowToProjectBrief)
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createProjectBriefRepository(userId: string): ProjectBriefRepository {
  return new ProjectBriefRepository(userId)
}
