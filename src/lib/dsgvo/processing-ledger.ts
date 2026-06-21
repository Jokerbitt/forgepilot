/**
 * DSGVO Processing Ledger — Art. 30 DSGVO
 *
 * Every AI API call must be logged here. Records:
 *   - What data was processed (types, not content)
 *   - Who processed it (which AI provider)
 *   - Where data was processed (data residency)
 *   - Legal basis for processing
 *   - Whether PII was detected and redacted
 *
 * Stored in Supabase (processing_ledger table) when available,
 * falling back to local JSON.
 *
 * Retention: 5 years (legal obligation, Art. 30 DSGVO).
 */

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { desc, lt } from 'drizzle-orm'
import { getDataDir } from '@/lib/config/paths'
import { getSupabaseClient } from '@/lib/supabase/client'
import { dsgvoLogger } from '@/lib/logger'
import type { PIIFinding } from '@/lib/context/pii-scrubber'
import { getDb, isDatabaseConfigured } from '@/db/index'
import { processingLedger } from '@/db/schema'

export type LegalBasis =
  | 'legitimate-interest'   // Art. 6(1)(f) — most agent tasks
  | 'contract'              // Art. 6(1)(b) — direct user request
  | 'legal-obligation'      // Art. 6(1)(c) — audit logs
  | 'consent'               // Art. 6(1)(a) — explicit user consent

export type DataResidency = 'eu' | 'us' | 'local' | 'unknown'

export interface ProcessingRecord {
  id: string
  purpose: string
  dataTypes: string[]
  processor: string       // provider id, e.g. 'anthropic', 'groq', 'ollama'
  legalBasis: LegalBasis
  dataSubjectId?: string
  piiDetected: boolean
  piiCategories: string[]
  piiRedacted: boolean
  piiCount: number
  dataResidency: DataResidency
  providerId?: string
  modelId?: string
  inputTokens?: number
  retentionDays: number
  processedAt: string
}

// Retention: 5 years for processing ledger (Art. 30 DSGVO)
const LEDGER_RETENTION_DAYS = 1825

function getLedgerPath(): string {
  return path.join(getDataDir(), 'processing-ledger.json')
}

function readLedger(): ProcessingRecord[] {
  try {
    return JSON.parse(fs.readFileSync(getLedgerPath(), 'utf-8')) as ProcessingRecord[]
  } catch {
    return []
  }
}

function writeLedger(records: ProcessingRecord[]): void {
  const dir = path.dirname(getLedgerPath())
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = getLedgerPath() + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(records, null, 2), 'utf-8')
  fs.renameSync(tmp, getLedgerPath())
}

function fromDbRecord(record: typeof processingLedger.$inferSelect): ProcessingRecord {
  return {
    id: record.id,
    purpose: record.purpose,
    dataTypes: record.dataTypes,
    processor: record.processor,
    legalBasis: record.legalBasis,
    dataSubjectId: record.dataSubjectId ?? undefined,
    piiDetected: record.piiDetected,
    piiCategories: record.piiCategories,
    piiRedacted: record.piiRedacted,
    piiCount: record.piiCount,
    dataResidency: record.dataResidency,
    providerId: record.providerId ?? undefined,
    modelId: record.modelId ?? undefined,
    inputTokens: record.inputTokens ?? undefined,
    retentionDays: record.retentionDays,
    processedAt: record.processedAt.toISOString(),
  }
}

function toDbRecord(record: ProcessingRecord): typeof processingLedger.$inferInsert {
  return {
    id: record.id,
    purpose: record.purpose,
    dataTypes: record.dataTypes,
    processor: record.processor,
    legalBasis: record.legalBasis,
    dataSubjectId: record.dataSubjectId,
    piiDetected: record.piiDetected,
    piiCategories: record.piiCategories,
    piiRedacted: record.piiRedacted,
    piiCount: record.piiCount,
    dataResidency: record.dataResidency,
    providerId: record.providerId,
    modelId: record.modelId,
    inputTokens: record.inputTokens,
    retentionDays: record.retentionDays,
    processedAt: new Date(record.processedAt),
  }
}

export interface LogProcessingInput {
  purpose: string
  dataTypes: string[]
  providerId: string
  modelId?: string
  legalBasis?: LegalBasis
  dataSubjectId?: string
  piiFindings?: PIIFinding[]
  piiRedacted?: boolean
  dataResidency?: DataResidency
  inputTokens?: number
}

/**
 * Log an AI processing event to the DSGVO ledger.
 * Call this after every generateText() / generateEmbedding() invocation.
 */
export async function logProcessing(input: LogProcessingInput): Promise<void> {
  const record: ProcessingRecord = {
    id:             crypto.randomUUID(),
    purpose:        input.purpose,
    dataTypes:      input.dataTypes,
    processor:      input.providerId,
    legalBasis:     input.legalBasis ?? 'legitimate-interest',
    dataSubjectId:  input.dataSubjectId,
    piiDetected:    (input.piiFindings?.length ?? 0) > 0,
    piiCategories:  input.piiFindings?.map(f => f.type) ?? [],
    piiRedacted:    input.piiRedacted ?? false,
    piiCount:       input.piiFindings?.reduce((s, f) => s + f.count, 0) ?? 0,
    dataResidency:  input.dataResidency ?? inferResidency(input.providerId),
    providerId:     input.providerId,
    modelId:        input.modelId,
    inputTokens:    input.inputTokens,
    retentionDays:  LEDGER_RETENTION_DAYS,
    processedAt:    new Date().toISOString(),
  }

  // Supabase first (preferred — full query + retention enforcement)
  const sb = getSupabaseClient()
  if (sb) {
    await sb.from('processing_ledger').insert({
      id:             record.id,
      purpose:        record.purpose,
      data_types:     record.dataTypes,
      processor:      record.processor,
      legal_basis:    record.legalBasis,
      data_subject_id: record.dataSubjectId,
      pii_detected:   record.piiDetected,
      pii_categories: record.piiCategories,
      pii_redacted:   record.piiRedacted,
      pii_count:      record.piiCount,
      data_residency: record.dataResidency,
      provider_id:    record.providerId,
      model_id:       record.modelId,
      input_tokens:   record.inputTokens,
      retention_days: record.retentionDays,
    }).then((_r) => { /* fire-and-forget */ }, (err: unknown) => { dsgvoLogger.error({ event: 'ledger.insert_error', error: String(err) }, 'Failed to insert processing ledger record to Supabase') })
    return
  }

  if (isDatabaseConfigured()) {
    try {
      await getDb()
        .insert(processingLedger)
        .values(toDbRecord(record))
        .onConflictDoNothing()
      return
    } catch (err) {
      dsgvoLogger.error(
        { event: 'ledger.postgres_insert_error', error: err instanceof Error ? err.message : String(err) },
        'Failed to insert processing ledger record to Postgres; falling back to JSON',
      )
    }
  }

  // JSON fallback: cap at 10_000 entries (5 years * ~5/day)
  const records = readLedger()
  records.unshift(record)
  writeLedger(records.slice(0, 10_000))
}

export function readProcessingLedger(limit = 100): ProcessingRecord[] {
  return readLedger().slice(0, limit)
}

export async function readProcessingLedgerAsync(limit = 100): Promise<ProcessingRecord[]> {
  if (isDatabaseConfigured()) {
    try {
      const rows = await getDb()
        .select()
        .from(processingLedger)
        .orderBy(desc(processingLedger.processedAt))
        .limit(limit)
      return rows.map(fromDbRecord)
    } catch (err) {
      dsgvoLogger.error(
        { event: 'ledger.postgres_read_error', error: err instanceof Error ? err.message : String(err) },
        'Failed to read processing ledger from Postgres; falling back to JSON',
      )
    }
  }
  return readProcessingLedger(limit)
}

export function getLedgerStats(): {
  total: number
  piiDetected: number
  piiRedacted: number
  byProvider: Record<string, number>
  byResidency: Record<string, number>
  last24h: number
} {
  const all = readLedger()
  const cutoff = new Date(Date.now() - 86_400_000).toISOString()

  return {
    total:       all.length,
    piiDetected: all.filter(r => r.piiDetected).length,
    piiRedacted: all.filter(r => r.piiRedacted).length,
    byProvider:  Object.fromEntries(
      Array.from(new Set(all.map(r => r.processor))).map(p => [p, all.filter(r => r.processor === p).length])
    ),
    byResidency: Object.fromEntries(
      (['eu', 'us', 'local', 'unknown'] as DataResidency[]).map(r => [r, all.filter(e => e.dataResidency === r).length])
    ),
    last24h:     all.filter(r => r.processedAt > cutoff).length,
  }
}

export async function getLedgerStatsAsync(): Promise<ReturnType<typeof getLedgerStats>> {
  const all = await readProcessingLedgerAsync(10_000)
  const cutoff = new Date(Date.now() - 86_400_000).toISOString()

  return {
    total:       all.length,
    piiDetected: all.filter(r => r.piiDetected).length,
    piiRedacted: all.filter(r => r.piiRedacted).length,
    byProvider:  Object.fromEntries(
      Array.from(new Set(all.map(r => r.processor))).map(p => [p, all.filter(r => r.processor === p).length])
    ),
    byResidency: Object.fromEntries(
      (['eu', 'us', 'local', 'unknown'] as DataResidency[]).map(r => [r, all.filter(e => e.dataResidency === r).length])
    ),
    last24h:     all.filter(r => r.processedAt > cutoff).length,
  }
}

/** Cleanup entries older than their retention period */
export async function runRetentionCleanup(): Promise<{ deleted: number }> {
  if (isDatabaseConfigured()) {
    try {
      const cutoff = new Date(Date.now() - LEDGER_RETENTION_DAYS * 86_400_000)
      const deleted = await getDb()
        .delete(processingLedger)
        .where(lt(processingLedger.processedAt, cutoff))
        .returning({ id: processingLedger.id })
      return { deleted: deleted.length }
    } catch (err) {
      dsgvoLogger.error(
        { event: 'ledger.postgres_cleanup_error', error: err instanceof Error ? err.message : String(err) },
        'Failed to clean processing ledger in Postgres; falling back to JSON',
      )
    }
  }

  const records = readLedger()
  const now     = Date.now()
  const kept    = records.filter(r => {
    const age = (now - new Date(r.processedAt).getTime()) / 86_400_000
    return age < r.retentionDays
  })
  const deleted = records.length - kept.length
  if (deleted > 0) writeLedger(kept)
  return { deleted }
}

function inferResidency(providerId: string): DataResidency {
  const EU_PROVIDERS  = ['mistral']
  const LOCAL_PROVIDERS = ['ollama', 'lm-studio']
  const US_PROVIDERS  = ['anthropic', 'openai', 'groq', 'google-gemini', 'together']

  if (EU_PROVIDERS.includes(providerId))    return 'eu'
  if (LOCAL_PROVIDERS.includes(providerId)) return 'local'
  if (US_PROVIDERS.includes(providerId))    return 'us'
  return 'unknown'
}
