import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import { computeCriticalPath } from './criticalPath'

// We mock the fs module to control what linear-issues.json contains
vi.mock('fs')

const mockedFs = vi.mocked(fs)

function setupIssuesFile(issues: unknown[]): void {
  mockedFs.existsSync.mockReturnValue(true)
  mockedFs.readFileSync.mockReturnValue(JSON.stringify({ issues }))
}

function setupMissingFile(): void {
  mockedFs.existsSync.mockReturnValue(false)
}

beforeEach(() => {
  vi.resetAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('computeCriticalPath', () => {
  it('returns empty result when no issues file exists', async () => {
    setupMissingFile()
    const result = await computeCriticalPath()
    expect(result).toEqual({ issues: [], totalEstimate: 0, longestChain: 0 })
  })

  it('returns empty result for empty issues array', async () => {
    setupIssuesFile([])
    const result = await computeCriticalPath()
    expect(result).toEqual({ issues: [], totalEstimate: 0, longestChain: 0 })
  })

  it('returns linear chain A→B→C as critical path with longestChain=3', async () => {
    setupIssuesFile([
      { id: 'A', title: 'Issue A', priority: 1, status: 'todo', estimate: 2, blocks: ['B'] },
      { id: 'B', title: 'Issue B', priority: 1, status: 'todo', estimate: 3, blocks: ['C'] },
      { id: 'C', title: 'Issue C', priority: 1, status: 'todo', estimate: 1 },
    ])
    const result = await computeCriticalPath()
    expect(result.longestChain).toBe(3)
    expect(result.issues.map((i) => i.id)).toEqual(['A', 'B', 'C'])
    expect(result.totalEstimate).toBe(6)
  })

  it('picks the longer branch for parallel paths (A→B and A→C→D)', async () => {
    // A blocks B (chain length 2)
    // A blocks C, C blocks D (chain length 3 from A)
    setupIssuesFile([
      { id: 'A', title: 'Issue A', priority: 2, status: 'todo', estimate: 1, blocks: ['B', 'C'] },
      { id: 'B', title: 'Issue B', priority: 1, status: 'todo', estimate: 1 },
      { id: 'C', title: 'Issue C', priority: 1, status: 'todo', estimate: 1, blocks: ['D'] },
      { id: 'D', title: 'Issue D', priority: 1, status: 'todo', estimate: 1 },
    ])
    const result = await computeCriticalPath()
    expect(result.longestChain).toBe(3)
    expect(result.issues.map((i) => i.id)).toEqual(['A', 'C', 'D'])
  })

  it('returns disconnected nodes sorted by priority descending when no dependencies', async () => {
    setupIssuesFile([
      { id: 'X', title: 'Issue X', priority: 1, status: 'todo', estimate: 2 },
      { id: 'Y', title: 'Issue Y', priority: 3, status: 'todo', estimate: 4 },
      { id: 'Z', title: 'Issue Z', priority: 2, status: 'todo', estimate: 1 },
    ])
    const result = await computeCriticalPath()
    expect(result.issues.map((i) => i.id)).toEqual(['Y', 'Z', 'X'])
    expect(result.longestChain).toBe(3)
    expect(result.totalEstimate).toBe(7)
  })

  it('handles blockedBy relation: B is blockedBy A means A must come before B', async () => {
    setupIssuesFile([
      { id: 'A', title: 'Issue A', priority: 1, status: 'todo', estimate: 1 },
      { id: 'B', title: 'Issue B', priority: 1, status: 'todo', estimate: 2, blockedBy: ['A'] },
      { id: 'C', title: 'Issue C', priority: 1, status: 'todo', estimate: 3, blockedBy: ['B'] },
    ])
    const result = await computeCriticalPath()
    expect(result.longestChain).toBe(3)
    expect(result.issues.map((i) => i.id)).toEqual(['A', 'B', 'C'])
  })

  it('never throws — returns empty result on malformed JSON', async () => {
    mockedFs.existsSync.mockReturnValue(true)
    mockedFs.readFileSync.mockReturnValue('not valid json {{')
    await expect(computeCriticalPath()).resolves.toEqual({
      issues: [],
      totalEstimate: 0,
      longestChain: 0,
    })
  })

  it('never throws — returns empty result when readFileSync throws', async () => {
    mockedFs.existsSync.mockReturnValue(true)
    mockedFs.readFileSync.mockImplementation(() => {
      throw new Error('disk error')
    })
    await expect(computeCriticalPath()).resolves.toEqual({
      issues: [],
      totalEstimate: 0,
      longestChain: 0,
    })
  })

  it('handles issues without estimate (estimate is optional)', async () => {
    setupIssuesFile([
      { id: 'A', title: 'Issue A', priority: 1, status: 'todo', blocks: ['B'] },
      { id: 'B', title: 'Issue B', priority: 1, status: 'todo' },
    ])
    const result = await computeCriticalPath()
    expect(result.longestChain).toBe(2)
    expect(result.totalEstimate).toBe(0)
    expect(result.issues[0]).not.toHaveProperty('estimate')
  })
})
