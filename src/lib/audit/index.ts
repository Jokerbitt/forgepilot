import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

export type AuditAction =
  | 'delegation.created'
  | 'delegation.approved'
  | 'delegation.rejected'
  | 'delegation.started'
  | 'delegation.completed'
  | 'delegation.failed'
  | 'brief.created'
  | 'brief.accepted'
  | 'brief.updated'
  | 'brief.deleted'

export interface AuditEntry {
  id: string
  action: AuditAction
  entityId: string
  entityType: 'delegation' | 'brief'
  entityTitle?: string
  actor: string // 'system' | 'user' | source name
  metadata?: Record<string, unknown>
  createdAt: string
}

const AUDIT_PATH = path.join(process.cwd(), 'config', 'audit-log.json')

function readAuditLog(): AuditEntry[] {
  try {
    if (!fs.existsSync(AUDIT_PATH)) return []
    return JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf-8')) as AuditEntry[]
  } catch {
    return []
  }
}

function writeAuditLog(entries: AuditEntry[]): void {
  fs.mkdirSync(path.dirname(AUDIT_PATH), { recursive: true })
  const tmp = AUDIT_PATH + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(entries, null, 2))
  fs.renameSync(tmp, AUDIT_PATH)
}

export function logAuditEvent(params: Omit<AuditEntry, 'id' | 'createdAt'>): AuditEntry {
  const entry: AuditEntry = {
    ...params,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  }
  const entries = readAuditLog()
  // Keep last 1000 entries
  const updated = [entry, ...entries].slice(0, 1000)
  writeAuditLog(updated)
  return entry
}

export function getAuditLog(limit = 50, entityId?: string): AuditEntry[] {
  const entries = readAuditLog()
  const filtered = entityId ? entries.filter(e => e.entityId === entityId) : entries
  return filtered.slice(0, limit)
}

export function getAuditStats(): { total: number; last24h: number; byAction: Record<string, number> } {
  const entries = readAuditLog()
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const last24h = entries.filter(e => e.createdAt > yesterday).length
  const byAction: Record<string, number> = {}
  for (const e of entries) {
    byAction[e.action] = (byAction[e.action] ?? 0) + 1
  }
  return { total: entries.length, last24h, byAction }
}
