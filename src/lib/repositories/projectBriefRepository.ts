import path from 'path'
import { randomUUID } from 'crypto'
import { eq, desc } from 'drizzle-orm'
import type { ProjectBrief, ProjectBriefStatus } from '@/lib/models/project-brief'
import {
  readProjectBriefs,
  writeProjectBriefs,
} from '@/lib/project-briefs'
import { isDatabaseConfigured, getDb } from '@/db/index'
import { projectBriefs, type DbProjectBrief } from '@/db/schema'

const PROJECT_BRIEFS_FILE = path.join(process.cwd(), 'config', 'project-briefs.json')

export type CreateProjectBriefInput = Omit<ProjectBrief, 'id' | 'createdAt' | 'updatedAt'> &
  Partial<Pick<ProjectBrief, 'id' | 'createdAt' | 'updatedAt'>>

export interface ProjectBriefRepository {
  /** Create a new project brief. Generates id/timestamps if not provided. */
  create(input: CreateProjectBriefInput): Promise<ProjectBrief>
  /** Find a project brief by id. Returns null if not found. */
  findById(id: string): Promise<ProjectBrief | null>
  /** Update fields on an existing project brief. Returns null if not found. */
  update(id: string, patch: Partial<ProjectBrief>): Promise<ProjectBrief | null>
  /** Delete a project brief by id. Returns true if deleted, false if not found. */
  delete(id: string): Promise<boolean>
  /** List all project briefs. */
  listAll(): Promise<ProjectBrief[]>
  /** List project briefs filtered by status. */
  listByStatus(status: ProjectBriefStatus): Promise<ProjectBrief[]>
}

// ─── Row → Domain mapper ─────────────────────────────────────────────────────

function rowToProjectBrief(row: DbProjectBrief): ProjectBrief {
  const content = row.content as unknown as Omit<ProjectBrief, 'id' | 'title' | 'status' | 'createdAt' | 'updatedAt'>
  return {
    id: row.id,
    title: row.title,
    status: row.status as ProjectBriefStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...content,
  }
}

function briefToContent(brief: Omit<ProjectBrief, 'id' | 'title' | 'status' | 'createdAt' | 'updatedAt'>): Record<string, unknown> {
  return brief as unknown as Record<string, unknown>
}

// ─── Postgres implementation ─────────────────────────────────────────────────

class PostgresProjectBriefRepository implements ProjectBriefRepository {
  async create(input: CreateProjectBriefInput): Promise<ProjectBrief> {
    const db = getDb()
    const now = new Date()
    const id = input.id ?? randomUUID()
    const createdAt = input.createdAt ? new Date(input.createdAt) : now
    const updatedAt = input.updatedAt ? new Date(input.updatedAt) : now

    const { id: _id, title, status, createdAt: _ca, updatedAt: _ua, ...rest } = { id, ...input }
    const dbStatus = (status ?? 'draft') as 'draft' | 'in_review' | 'research' | 'accepted' | 'archived'

    const rows = await db
      .insert(projectBriefs)
      .values({
        id,
        title,
        status: dbStatus,
        content: briefToContent(rest as Omit<ProjectBrief, 'id' | 'title' | 'status' | 'createdAt' | 'updatedAt'>),
        version: 1,
        createdAt,
        updatedAt,
      })
      .returning()

    if (!rows[0]) throw new Error('Insert returned no rows')
    return rowToProjectBrief(rows[0])
  }

  async findById(id: string): Promise<ProjectBrief | null> {
    const db = getDb()
    const rows = await db
      .select()
      .from(projectBriefs)
      .where(eq(projectBriefs.id, id))
      .limit(1)
    return rows[0] ? rowToProjectBrief(rows[0]) : null
  }

  async update(id: string, patch: Partial<ProjectBrief>): Promise<ProjectBrief | null> {
    const db = getDb()
    const existing = await this.findById(id)
    if (!existing) return null

    const now = new Date()
    const merged: ProjectBrief = {
      ...existing,
      ...patch,
      id,
      createdAt: existing.createdAt,
      updatedAt: now.toISOString(),
    }

    const { id: _id, title, status, createdAt: _ca, updatedAt: _ua, ...rest } = merged
    const dbStatus = status as 'draft' | 'in_review' | 'research' | 'accepted' | 'archived'

    const rows = await db
      .update(projectBriefs)
      .set({
        title,
        status: dbStatus,
        content: briefToContent(rest),
        updatedAt: now,
      })
      .where(eq(projectBriefs.id, id))
      .returning()

    return rows[0] ? rowToProjectBrief(rows[0]) : null
  }

  async delete(id: string): Promise<boolean> {
    const db = getDb()
    const rows = await db
      .delete(projectBriefs)
      .where(eq(projectBriefs.id, id))
      .returning({ id: projectBriefs.id })
    return rows.length > 0
  }

  async listAll(): Promise<ProjectBrief[]> {
    const db = getDb()
    const rows = await db
      .select()
      .from(projectBriefs)
      .orderBy(desc(projectBriefs.createdAt))
    return rows.map(rowToProjectBrief)
  }

  async listByStatus(status: ProjectBriefStatus): Promise<ProjectBrief[]> {
    const db = getDb()
    const dbStatus = status as 'draft' | 'in_review' | 'research' | 'accepted' | 'archived'
    const rows = await db
      .select()
      .from(projectBriefs)
      .where(eq(projectBriefs.status, dbStatus))
      .orderBy(desc(projectBriefs.createdAt))
    return rows.map(rowToProjectBrief)
  }
}

// ─── JSON fallback implementation ────────────────────────────────────────────

class JsonProjectBriefRepository implements ProjectBriefRepository {
  constructor(private readonly filePath = PROJECT_BRIEFS_FILE) {}

  async create(input: CreateProjectBriefInput): Promise<ProjectBrief> {
    const now = new Date().toISOString()
    const brief: ProjectBrief = {
      ...input,
      id: input.id ?? randomUUID(),
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    }
    const all = readProjectBriefs(this.filePath)
    all.unshift(brief)
    writeProjectBriefs(all, this.filePath)
    return brief
  }

  async findById(id: string): Promise<ProjectBrief | null> {
    const all = readProjectBriefs(this.filePath)
    return all.find(b => b.id === id) ?? null
  }

  async update(id: string, patch: Partial<ProjectBrief>): Promise<ProjectBrief | null> {
    const all = readProjectBriefs(this.filePath)
    const idx = all.findIndex(b => b.id === id)
    if (idx === -1) return null
    const updated: ProjectBrief = {
      ...all[idx],
      ...patch,
      id,
      createdAt: all[idx].createdAt,
      updatedAt: new Date().toISOString(),
    }
    all[idx] = updated
    writeProjectBriefs(all, this.filePath)
    return updated
  }

  async delete(id: string): Promise<boolean> {
    const all = readProjectBriefs(this.filePath)
    const idx = all.findIndex(b => b.id === id)
    if (idx === -1) return false
    all.splice(idx, 1)
    writeProjectBriefs(all, this.filePath)
    return true
  }

  async listAll(): Promise<ProjectBrief[]> {
    return readProjectBriefs(this.filePath)
  }

  async listByStatus(status: ProjectBriefStatus): Promise<ProjectBrief[]> {
    const all = readProjectBriefs(this.filePath)
    return all.filter(b => b.status === status)
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createProjectBriefRepository(_userId?: string, filePath = PROJECT_BRIEFS_FILE): ProjectBriefRepository {
  if (isDatabaseConfigured()) {
    return new PostgresProjectBriefRepository()
  }
  return new JsonProjectBriefRepository(filePath)
}
