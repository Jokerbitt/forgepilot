import path from 'path'
import { randomUUID } from 'crypto'
import type { ProjectBrief, ProjectBriefStatus } from '@/lib/models/project-brief'
import {
  readProjectBriefs,
  writeProjectBriefs,
} from '@/lib/project-briefs'

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

export function createProjectBriefRepository(filePath = PROJECT_BRIEFS_FILE): ProjectBriefRepository {
  return {
    async create(input: CreateProjectBriefInput): Promise<ProjectBrief> {
      const now = new Date().toISOString()
      const brief: ProjectBrief = {
        ...input,
        id: input.id ?? randomUUID(),
        createdAt: input.createdAt ?? now,
        updatedAt: input.updatedAt ?? now,
      }
      const all = readProjectBriefs(filePath)
      all.unshift(brief)
      writeProjectBriefs(all, filePath)
      return brief
    },

    async findById(id: string): Promise<ProjectBrief | null> {
      const all = readProjectBriefs(filePath)
      return all.find(b => b.id === id) ?? null
    },

    async update(id: string, patch: Partial<ProjectBrief>): Promise<ProjectBrief | null> {
      const all = readProjectBriefs(filePath)
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
      writeProjectBriefs(all, filePath)
      return updated
    },

    async delete(id: string): Promise<boolean> {
      const all = readProjectBriefs(filePath)
      const idx = all.findIndex(b => b.id === id)
      if (idx === -1) return false
      all.splice(idx, 1)
      writeProjectBriefs(all, filePath)
      return true
    },

    async listAll(): Promise<ProjectBrief[]> {
      return readProjectBriefs(filePath)
    },

    async listByStatus(status: ProjectBriefStatus): Promise<ProjectBrief[]> {
      const all = readProjectBriefs(filePath)
      return all.filter(b => b.status === status)
    },
  }
}
