/**
 * Tests for DSGVO ZIP Export — Art. 20 DSGVO
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import JSZip from 'jszip'

let tmpDir: string

vi.mock('@/lib/config/paths', () => ({
  getConfigPath: (filename: string) => path.join(tmpDir, filename),
  getDataDir: () => tmpDir,
}))

// Import after mock
import { buildDsgvoExportZip } from '@/lib/dsgvo/zip-export'

describe('buildDsgvoExportZip()', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgepilot-dsgvo-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    vi.resetModules()
  })

  it('returns a Buffer', async () => {
    const result = await buildDsgvoExportZip()
    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBeGreaterThan(0)
  })

  it('ZIP contains README.md and metadata.json', async () => {
    const buffer = await buildDsgvoExportZip()
    const zip = await JSZip.loadAsync(buffer)

    const files = Object.keys(zip.files)
    expect(files.some(f => f.endsWith('README.md'))).toBe(true)
    expect(files.some(f => f.endsWith('metadata.json'))).toBe(true)
  })

  it('ZIP contains all expected data files', async () => {
    // Seed some test data
    const ledger = [
      { id: 'rec-1', purpose: 'test', processor: 'anthropic', processedAt: new Date().toISOString() },
    ]
    fs.writeFileSync(path.join(tmpDir, 'processing-ledger.json'), JSON.stringify(ledger))

    const buffer = await buildDsgvoExportZip()
    const zip = await JSZip.loadAsync(buffer)
    const files = Object.keys(zip.files)

    expect(files.some(f => f.endsWith('processing-ledger.json'))).toBe(true)
    expect(files.some(f => f.endsWith('delegations.json'))).toBe(true)
    expect(files.some(f => f.endsWith('project-briefs.json'))).toBe(true)
  })

  it('metadata.json contains exportedAt, version, and recordCounts', async () => {
    const buffer = await buildDsgvoExportZip()
    const zip = await JSZip.loadAsync(buffer)

    const metaFile = zip.file('forgepilot-export/metadata.json')
    expect(metaFile).not.toBeNull()

    const raw = await metaFile!.async('string')
    const meta = JSON.parse(raw) as {
      exportedAt: string
      version: string
      recordCounts: { processingLedger: number; delegations: number; projectBriefs: number }
    }

    expect(typeof meta.exportedAt).toBe('string')
    expect(typeof meta.version).toBe('string')
    expect(meta.recordCounts).toBeDefined()
    expect(typeof meta.recordCounts.processingLedger).toBe('number')
  })

  it('reflects actual record count in metadata', async () => {
    const ledger = [
      { id: 'rec-1', purpose: 'test-1', dataSubjectId: 'user-abc' },
      { id: 'rec-2', purpose: 'test-2', dataSubjectId: 'user-abc' },
    ]
    fs.writeFileSync(path.join(tmpDir, 'processing-ledger.json'), JSON.stringify(ledger))

    const buffer = await buildDsgvoExportZip()
    const zip = await JSZip.loadAsync(buffer)
    const metaFile = zip.file('forgepilot-export/metadata.json')
    const raw = await metaFile!.async('string')
    const meta = JSON.parse(raw) as { recordCounts: { processingLedger: number }; dataSubjectsCount: number }

    expect(meta.recordCounts.processingLedger).toBe(2)
    expect(meta.dataSubjectsCount).toBe(1) // single unique dataSubjectId
  })
})
