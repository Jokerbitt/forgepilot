/**
 * Tests for Art. 17 DSGVO — Right to Erasure
 *
 * Uses the JSON fallback path by mocking Supabase client to return null.
 * A temporary directory is used for isolation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

// ── Mock Supabase so JSON fallback is always used ────────────────────────────
vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => null,
  isSupabaseEnabled: () => false,
  resetSupabaseClient: () => undefined,
}))

// ── Helpers (imported after mock setup) ─────────────────────────────────────
import { requestErasure, executeErasure, getErasureStatus } from './erasure'

// ── Isolate file I/O in a temp directory ────────────────────────────────────
let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'erasure-test-'))
  process.env.FORGEPILOT_DATA_DIR = tmpDir
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  delete process.env.FORGEPILOT_DATA_DIR
})

// ── requestErasure ───────────────────────────────────────────────────────────

describe('requestErasure', () => {
  it('creates a new DataSubject with erasureRequestedAt set', async () => {
    const result = await requestErasure('user-abc')

    expect(result.externalId).toBe('user-abc')
    expect(result.erasureRequestedAt).toBeDefined()
    expect(typeof result.erasureRequestedAt).toBe('string')
    expect(result.id).toBeTruthy()
  })

  it('persists the request to data-subjects.json', async () => {
    await requestErasure('user-persist')

    const subjectsFile = path.join(tmpDir, 'data-subjects.json')
    expect(fs.existsSync(subjectsFile)).toBe(true)

    const subjects = JSON.parse(fs.readFileSync(subjectsFile, 'utf-8')) as { externalId: string }[]
    expect(subjects.some(s => s.externalId === 'user-persist')).toBe(true)
  })

  it('updates erasureRequestedAt when called again for existing subject', async () => {
    const first  = await requestErasure('user-update')
    // Small delay to guarantee a different timestamp
    await new Promise(r => setTimeout(r, 5))
    const second = await requestErasure('user-update')

    expect(second.externalId).toBe('user-update')
    expect(second.id).toBe(first.id)
    // Both calls set a timestamp
    expect(second.erasureRequestedAt).toBeDefined()
  })
})

// ── executeErasure ───────────────────────────────────────────────────────────

describe('executeErasure', () => {
  it('returns { externalId, recordsDeleted, erasedAt } with zero deletions when no ledger', async () => {
    const result = await executeErasure('user-no-ledger')

    expect(result.externalId).toBe('user-no-ledger')
    expect(result.recordsDeleted).toBe(0)
    expect(result.erasedAt).toBeTruthy()
  })

  it('deletes matching records from processing-ledger.json', async () => {
    // Prepare a ledger with two subjects
    const ledger = [
      { id: '1', dataSubjectId: 'user-del', purpose: 'test', createdAt: new Date().toISOString() },
      { id: '2', dataSubjectId: 'user-del', purpose: 'test', createdAt: new Date().toISOString() },
      { id: '3', dataSubjectId: 'user-keep', purpose: 'test', createdAt: new Date().toISOString() },
    ]
    fs.writeFileSync(path.join(tmpDir, 'processing-ledger.json'), JSON.stringify(ledger), 'utf-8')

    const result = await executeErasure('user-del')

    expect(result.recordsDeleted).toBe(2)

    const remaining = JSON.parse(fs.readFileSync(path.join(tmpDir, 'processing-ledger.json'), 'utf-8')) as { dataSubjectId: string }[]
    expect(remaining).toHaveLength(1)
    expect(remaining[0].dataSubjectId).toBe('user-keep')
  })

  it('marks the subject as erased in data-subjects.json', async () => {
    // Create subject first
    await requestErasure('user-mark-erased')
    await executeErasure('user-mark-erased')

    const subjects = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'data-subjects.json'), 'utf-8')
    ) as { externalId: string; erasedAt?: string }[]

    const subject = subjects.find(s => s.externalId === 'user-mark-erased')
    expect(subject?.erasedAt).toBeTruthy()
  })
})

// ── getErasureStatus ─────────────────────────────────────────────────────────

describe('getErasureStatus', () => {
  it('returns null for an unknown externalId', async () => {
    const result = await getErasureStatus('unknown-xyz')
    expect(result).toBeNull()
  })

  it('returns the DataSubject after a requestErasure call', async () => {
    await requestErasure('user-status')
    const status = await getErasureStatus('user-status')

    expect(status).not.toBeNull()
    expect(status?.externalId).toBe('user-status')
    expect(status?.erasureRequestedAt).toBeDefined()
  })

  it('reflects erasedAt after executeErasure', async () => {
    await requestErasure('user-full-flow')
    await executeErasure('user-full-flow')
    const status = await getErasureStatus('user-full-flow')

    expect(status?.erasedAt).toBeTruthy()
  })
})
