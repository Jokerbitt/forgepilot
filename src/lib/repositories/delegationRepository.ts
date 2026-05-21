import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import type { Delegation, DelegationStatus } from '@/lib/models/delegation'
import { SINGLE_TENANT_USER_ID } from './base'

export { SINGLE_TENANT_USER_ID }

const DELEGATIONS_FILE = path.join(process.cwd(), 'config', 'delegations.json')

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

export type CreateDelegationInput = Omit<Delegation, 'id' | 'createdAt' | 'updatedAt'> &
  Partial<Pick<Delegation, 'id' | 'createdAt' | 'updatedAt'>>

export type UpdateDelegationInput = Partial<
  Omit<Delegation, 'id' | 'createdAt'>
>

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

export function createDelegationRepository(_userId: string): DelegationRepository {
  return {
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
    },

    async findById(id: string): Promise<Delegation | null> {
      const all = readAll()
      return all.find(d => d.id === id) ?? null
    },

    async update(id: string, patch: UpdateDelegationInput): Promise<Delegation | null> {
      const all = readAll()
      const idx = all.findIndex(d => d.id === id)
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
    },

    async delete(id: string): Promise<boolean> {
      const all = readAll()
      const idx = all.findIndex(d => d.id === id)
      if (idx === -1) return false
      all.splice(idx, 1)
      writeAll(all)
      return true
    },

    async listByStatus(statuses?: DelegationStatus[]): Promise<Delegation[]> {
      const all = readAll()
      if (!statuses || statuses.length === 0) return all
      const set = new Set<string>(statuses)
      return all.filter(d => set.has(d.status))
    },

    async listByProject(briefId: string): Promise<Delegation[]> {
      const all = readAll()
      return all.filter(d => d.briefId === briefId)
    },
  }
}
