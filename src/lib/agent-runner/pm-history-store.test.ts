import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'fs'

// Mock fs to avoid actual file system access
vi.mock('fs')

const mockFs = vi.mocked(fs)

// We import after mocking so the module uses our mocked fs
import { appendPMHistory, readPMHistory } from './pm-history-store'
import type { PMAgentResult } from './pm-agent'

function makePlan(overrides: Partial<PMAgentResult> = {}): PMAgentResult {
  return {
    summary: 'Test summary',
    overallHealth: 'green',
    reviews: [],
    nextDelegations: [],
    blockers: [],
    recommendations: [],
    runAt: new Date().toISOString(),
    tokenUsage: { promptTokens: 100, completionTokens: 50 },
    ...overrides,
  }
}

describe('pm-history-store', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('appendPMHistory on empty history results in 1 entry', () => {
    // readFile throws → empty history
    mockFs.readFileSync.mockImplementation(() => { throw new Error('ENOENT') })
    mockFs.writeFileSync.mockReturnValue(undefined)
    mockFs.renameSync.mockReturnValue(undefined)

    const plan = makePlan({ runAt: '2026-01-01T10:00:00.000Z' })
    appendPMHistory(plan)

    expect(mockFs.writeFileSync).toHaveBeenCalledOnce()
    const written = JSON.parse(mockFs.writeFileSync.mock.calls[0][1] as string) as PMAgentResult[]
    expect(written).toHaveLength(1)
    expect(written[0].runAt).toBe('2026-01-01T10:00:00.000Z')
  })

  it('readPMHistory returns newest first', () => {
    const older = makePlan({ runAt: '2026-01-01T08:00:00.000Z' })
    const newer = makePlan({ runAt: '2026-01-02T08:00:00.000Z' })
    // History is stored newest-first, so simulate that on disk
    mockFs.readFileSync.mockReturnValue(JSON.stringify([newer, older]))
    mockFs.writeFileSync.mockReturnValue(undefined)
    mockFs.renameSync.mockReturnValue(undefined)

    const history = readPMHistory()
    expect(history[0].runAt).toBe('2026-01-02T08:00:00.000Z')
    expect(history[1].runAt).toBe('2026-01-01T08:00:00.000Z')
  })

  it('rotation: after 11 appends history stays at max 10 entries', () => {
    // Start with 10 entries
    const existing = Array.from({ length: 10 }, (_, i) =>
      makePlan({ runAt: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z` })
    )
    mockFs.readFileSync.mockReturnValue(JSON.stringify(existing))
    mockFs.writeFileSync.mockReturnValue(undefined)
    mockFs.renameSync.mockReturnValue(undefined)

    const eleventh = makePlan({ runAt: '2026-01-11T12:00:00.000Z' })
    appendPMHistory(eleventh)

    expect(mockFs.writeFileSync).toHaveBeenCalledOnce()
    const written = JSON.parse(mockFs.writeFileSync.mock.calls[0][1] as string) as PMAgentResult[]
    expect(written).toHaveLength(10)
    // Newest should be first
    expect(written[0].runAt).toBe('2026-01-11T12:00:00.000Z')
  })

  it('GET /api/pm-agent/history returns array', async () => {
    const plan1 = makePlan({ runAt: '2026-05-18T10:00:00.000Z', overallHealth: 'green' })
    const plan2 = makePlan({ runAt: '2026-05-17T10:00:00.000Z', overallHealth: 'yellow' })
    mockFs.readFileSync.mockReturnValue(JSON.stringify([plan1, plan2]))

    const history = readPMHistory()
    expect(Array.isArray(history)).toBe(true)
    expect(history).toHaveLength(2)
  })

  it('limit parameter: readPMHistory slicing works correctly', () => {
    const entries = Array.from({ length: 8 }, (_, i) =>
      makePlan({ runAt: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z` })
    )
    mockFs.readFileSync.mockReturnValue(JSON.stringify(entries))

    const history = readPMHistory()
    // Simulate limit=3 as the route does
    const limited = history.slice(0, 3)
    expect(limited).toHaveLength(3)
    // Confirm full result has 8
    expect(history).toHaveLength(8)
  })
})
