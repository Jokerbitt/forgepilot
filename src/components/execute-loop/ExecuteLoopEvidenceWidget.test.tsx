import { describe, expect, it } from 'vitest'
import {
  evidenceSourceLabel,
  evidenceStatusTone,
  getMissingEvidenceSteps,
  type ExecuteLoopEvidenceRun,
} from './ExecuteLoopEvidenceWidget'

function makeRun(overrides: Partial<ExecuteLoopEvidenceRun> = {}): ExecuteLoopEvidenceRun {
  return {
    id: 'run-1',
    title: 'Small ticket loop',
    status: 'partial',
    source: 'manual',
    recordedAt: '2026-05-24T10:00:00.000Z',
    steps: {
      brief: true,
      delegation: true,
      execute: true,
      tests: false,
      pr: false,
      critic: true,
      writeback: false,
    },
    ...overrides,
  }
}

describe('ExecuteLoopEvidenceWidget helpers', () => {
  it('maps run status to UI tone', () => {
    expect(evidenceStatusTone('success')).toBe('success')
    expect(evidenceStatusTone('partial')).toBe('warning')
    expect(evidenceStatusTone('blocked')).toBe('danger')
  })

  it('labels evidence sources in user-facing language', () => {
    expect(evidenceSourceLabel('manual')).toBe('Manuell')
    expect(evidenceSourceLabel('runtime-aggregate')).toBe('Runtime')
    expect(evidenceSourceLabel('harness-dry-run')).toBe('Dry Run')
  })

  it('lists missing proof steps for partial runs', () => {
    expect(getMissingEvidenceSteps(makeRun())).toEqual(['Tests', 'PR', 'Writeback'])
  })

  it('returns no missing proof steps for complete runs', () => {
    expect(getMissingEvidenceSteps(makeRun({
      status: 'success',
      steps: {
        brief: true,
        delegation: true,
        execute: true,
        tests: true,
        pr: true,
        critic: true,
        writeback: true,
      },
    }))).toEqual([])
  })
})
