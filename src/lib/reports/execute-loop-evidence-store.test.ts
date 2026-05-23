import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import {
  appendExecuteLoopEvidence,
  normalizeEvidenceNotes,
  readExecuteLoopEvidence,
} from './execute-loop-evidence-store'

let tempDir: string | null = null

function tempFile(): string {
  tempDir = mkdtempSync(join(tmpdir(), 'forgepilot-evidence-'))
  return join(tempDir, 'execute-loop-evidence.json')
}

afterEach(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true })
  tempDir = null
})

describe('execute-loop-evidence-store', () => {
  it('persists manual evidence runs and replaces duplicate ids', () => {
    const filePath = tempFile()
    const first = appendExecuteLoopEvidence({
      id: 'run-1',
      title: 'First real run',
      status: 'success',
      source: 'manual',
      recordedAt: '2026-05-22T10:00:00.000Z',
      steps: {
        brief: true,
        delegation: true,
        execute: true,
        tests: true,
        pr: true,
        critic: true,
        writeback: true,
      },
    }, filePath)

    expect(first).toHaveLength(1)

    appendExecuteLoopEvidence({
      id: 'run-1',
      title: 'First real run corrected',
      status: 'partial',
      source: 'manual',
      recordedAt: '2026-05-22T10:05:00.000Z',
      steps: {
        brief: true,
        delegation: true,
        execute: true,
        tests: false,
        pr: false,
        critic: false,
        writeback: false,
      },
    }, filePath)

    const runs = readExecuteLoopEvidence(filePath)
    expect(runs).toHaveLength(1)
    expect(runs[0].title).toBe('First real run corrected')
  })

  it('accepts dry-run harness records but filters malformed records', () => {
    const filePath = tempFile()
    appendExecuteLoopEvidence({
      id: 'harness-1',
      title: 'Harness run',
      status: 'partial',
      source: 'harness-dry-run',
      recordedAt: '2026-05-22T10:10:00.000Z',
      notes: 'Dry-run only.',
      steps: {
        brief: true,
        delegation: true,
        execute: true,
        tests: true,
        pr: false,
        critic: true,
        writeback: false,
      },
    }, filePath)

    const runs = readExecuteLoopEvidence(filePath)
    expect(runs).toHaveLength(1)
    expect(runs[0].source).toBe('harness-dry-run')
  })

  it('normalizes repeated and oversized evidence notes', () => {
    const compact = normalizeEvidenceNotes([
      'PR evidence recorded after create-pr endpoint completed.',
      'Critic evidence recorded after critic-review endpoint completed.',
      'PR evidence recorded after create-pr endpoint completed.',
      'Knowledge writeback evidence recorded after delegation writeback completed.',
    ].join(' | '))

    expect(compact).toBe([
      'PR evidence recorded after create-pr endpoint completed.',
      'Critic evidence recorded after critic-review endpoint completed.',
      'Knowledge writeback evidence recorded after delegation writeback completed.',
    ].join(' | '))
    expect(compact?.length).toBeLessThanOrEqual(800)
  })
})
