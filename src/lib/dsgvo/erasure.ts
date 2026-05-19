/**
 * Right to Erasure — Art. 17 DSGVO
 *
 * Allows data subjects to request deletion of all their processing records.
 *
 * Two-step process (audit trail):
 *   1. requestErasure(externalId)  — records the request timestamp
 *   2. executeErasure(externalId)  — deletes records + marks subject as erased
 *
 * Supabase path: uses `data_subjects` table + CASCADE delete on `processing_ledger`.
 * JSON fallback: filters processing-ledger.json by dataSubjectId.
 */

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { getSupabaseClient } from '@/lib/supabase/client'
import { getDataDir } from '@/lib/config/paths'
import type { ProcessingRecord } from './processing-ledger'

export interface DataSubject {
  id: string
  externalId: string
  emailHash?: string
  createdAt: string
  erasureRequestedAt?: string
  erasedAt?: string
}

export interface ErasureResult {
  externalId: string
  recordsDeleted: number
  erasedAt: string
}

// ─── Supabase paths ───────────────────────────────────────────────────────────

/**
 * Record an erasure request for a data subject.
 * Does NOT delete data yet — creates an audit trail first.
 */
export async function requestErasure(externalId: string): Promise<DataSubject> {
  const sb  = getSupabaseClient()
  const now = new Date().toISOString()

  if (sb) {
    // Upsert data subject record with erasure request timestamp
    const { data, error } = await sb
      .from('data_subjects')
      .upsert({ external_id: externalId, erasure_requested_at: now }, { onConflict: 'external_id' })
      .select('id, external_id, email_hash, created_at, erasure_requested_at, erased_at')
      .single()

    if (error) throw new Error(`Erasure request failed: ${error.message}`)

    return {
      id:                  String((data as Record<string, unknown>).id ?? ''),
      externalId:          String((data as Record<string, unknown>).external_id ?? ''),
      emailHash:           (data as Record<string, unknown>).email_hash as string | undefined,
      createdAt:           String((data as Record<string, unknown>).created_at ?? ''),
      erasureRequestedAt:  String((data as Record<string, unknown>).erasure_requested_at ?? ''),
      erasedAt:            (data as Record<string, unknown>).erased_at as string | undefined,
    }
  }

  // JSON fallback — store request in local subjects file
  const subjects = readSubjectsFile()
  const existing = subjects.find(s => s.externalId === externalId)
  if (existing) {
    existing.erasureRequestedAt = now
    writeSubjectsFile(subjects)
    return existing
  }
  const subject: DataSubject = {
    id: crypto.randomUUID(), externalId, createdAt: now, erasureRequestedAt: now,
  }
  subjects.push(subject)
  writeSubjectsFile(subjects)
  return subject
}

/**
 * Execute the erasure: delete all processing records for the data subject,
 * then mark the subject as erased.
 */
export async function executeErasure(externalId: string): Promise<ErasureResult> {
  const sb  = getSupabaseClient()
  const now = new Date().toISOString()

  if (sb) {
    // Delete processing_ledger rows (CASCADE from data_subjects handles FK cleanup)
    const { count } = await sb
      .from('processing_ledger')
      .delete({ count: 'exact' })
      .eq('data_subject_id', externalId)

    // Mark data subject as erased
    await sb
      .from('data_subjects')
      .upsert({ external_id: externalId, erased_at: now }, { onConflict: 'external_id' })

    return { externalId, recordsDeleted: count ?? 0, erasedAt: now }
  }

  // JSON fallback
  const ledgerPath = path.join(getDataDir(), 'processing-ledger.json')
  let recordsDeleted = 0

  if (fs.existsSync(ledgerPath)) {
    const records = JSON.parse(fs.readFileSync(ledgerPath, 'utf-8')) as ProcessingRecord[]
    const kept    = records.filter(r => r.dataSubjectId !== externalId)
    recordsDeleted = records.length - kept.length
    const tmp = ledgerPath + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(kept, null, 2), 'utf-8')
    fs.renameSync(tmp, ledgerPath)
  }

  // Update local subjects
  const subjects = readSubjectsFile()
  const subject  = subjects.find(s => s.externalId === externalId)
  if (subject) {
    subject.erasedAt = now
    writeSubjectsFile(subjects)
  }

  return { externalId, recordsDeleted, erasedAt: now }
}

/**
 * Get the current erasure status for a data subject.
 */
export async function getErasureStatus(externalId: string): Promise<DataSubject | null> {
  const sb = getSupabaseClient()

  if (sb) {
    const { data } = await sb
      .from('data_subjects')
      .select('id, external_id, email_hash, created_at, erasure_requested_at, erased_at')
      .eq('external_id', externalId)
      .maybeSingle()

    if (!data) return null
    const d = data as Record<string, unknown>
    return {
      id:                 String(d.id ?? ''),
      externalId:         String(d.external_id ?? ''),
      emailHash:          d.email_hash as string | undefined,
      createdAt:          String(d.created_at ?? ''),
      erasureRequestedAt: d.erasure_requested_at as string | undefined,
      erasedAt:           d.erased_at as string | undefined,
    }
  }

  return readSubjectsFile().find(s => s.externalId === externalId) ?? null
}

// ─── JSON helpers ─────────────────────────────────────────────────────────────

function subjectsPath(): string {
  return path.join(getDataDir(), 'data-subjects.json')
}

function readSubjectsFile(): DataSubject[] {
  try { return JSON.parse(fs.readFileSync(subjectsPath(), 'utf-8')) as DataSubject[] }
  catch { return [] }
}

function writeSubjectsFile(subjects: DataSubject[]): void {
  const dir = path.dirname(subjectsPath())
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = subjectsPath() + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(subjects, null, 2), 'utf-8')
  fs.renameSync(tmp, subjectsPath())
}
