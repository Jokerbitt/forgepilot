import fs from 'fs'
import path from 'path'
import { getDataDir } from '@/lib/config/paths'
import type {
  PlanningApplyResult,
  PlanningAudit,
  PlanningRequestSummary,
} from '@/lib/planning/grok-planning-gateway'

export interface PlanningAuditRecord extends PlanningAudit {
  id: string
  recordedAt: string
  outcome: 'success' | 'partial' | 'preview'
  summary: PlanningRequestSummary
  created: PlanningApplyResult['created']
  skipped: PlanningApplyResult['skipped']
  warnings: string[]
}

interface PlanningAuditStore {
  records: PlanningAuditRecord[]
  updatedAt: string
}

export interface RecordPlanningAuditInput {
  audit: PlanningAudit
  summary: PlanningRequestSummary
  applyResult: PlanningApplyResult
  warnings: string[]
}

export interface PlanningAuditStats {
  total: number
  last24h: number
  byMode: Record<string, number>
  byOutcome: Record<string, number>
}

const MAX_RECORDS = 500

function getAuditFile(override?: string): string {
  return override ?? path.join(getDataDir(), 'planning-audit-log.json')
}

function readStore(file?: string): PlanningAuditStore {
  const p = getAuditFile(file)
  try {
    if (!fs.existsSync(p)) return { records: [], updatedAt: new Date().toISOString() }
    const parsed = JSON.parse(fs.readFileSync(p, 'utf-8')) as unknown
    if (!isStore(parsed)) return { records: [], updatedAt: new Date().toISOString() }
    return parsed
  } catch {
    return { records: [], updatedAt: new Date().toISOString() }
  }
}

function writeStore(store: PlanningAuditStore, file?: string): void {
  const p = getAuditFile(file)
  const dir = path.dirname(p)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = `${p}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf-8')
  fs.renameSync(tmp, p)
}

export function recordPlanningAudit(input: RecordPlanningAuditInput, file?: string): PlanningAuditRecord {
  const store = readStore(file)
  const recordedAt = new Date().toISOString()
  const record: PlanningAuditRecord = {
    ...input.audit,
    id: `plan-${input.audit.payloadHash.slice(0, 12)}-${Date.now()}`,
    recordedAt,
    outcome: inferOutcome(input.audit),
    summary: input.summary,
    created: input.applyResult.created,
    skipped: input.applyResult.skipped,
    warnings: input.warnings,
  }

  store.records.unshift(record)
  if (store.records.length > MAX_RECORDS) {
    store.records = store.records.slice(0, MAX_RECORDS)
  }
  store.updatedAt = recordedAt
  writeStore(store, file)
  return record
}

export function listPlanningAuditRecords(limit = 50, file?: string): PlanningAuditRecord[] {
  const store = readStore(file)
  return store.records.slice(0, Math.max(0, limit))
}

export function getPlanningAuditStats(file?: string): PlanningAuditStats {
  const records = readStore(file).records
  const yesterday = Date.now() - 24 * 60 * 60 * 1000
  const stats: PlanningAuditStats = {
    total: records.length,
    last24h: 0,
    byMode: {},
    byOutcome: {},
  }

  for (const record of records) {
    if (new Date(record.recordedAt).getTime() >= yesterday) {
      stats.last24h += 1
    }
    stats.byMode[record.mode] = (stats.byMode[record.mode] ?? 0) + 1
    stats.byOutcome[record.outcome] = (stats.byOutcome[record.outcome] ?? 0) + 1
  }

  return stats
}

function inferOutcome(audit: PlanningAudit): PlanningAuditRecord['outcome'] {
  if (audit.mode === 'preview') return 'preview'
  if (audit.skippedCount > 0 && audit.createdCount > 0) return 'partial'
  return 'success'
}

function isStore(value: unknown): value is PlanningAuditStore {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as { records?: unknown }).records) &&
    typeof (value as { updatedAt?: unknown }).updatedAt === 'string'
  )
}
