import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── fs mock ────────────────────────────────────────────────────────────────

let mockStore = '[]'

const fsMock = {
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn(() => mockStore),
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
  mkdirSync: vi.fn(),
}
vi.mock('fs', () => ({ default: fsMock, ...fsMock }))

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<{
  id: string
  idea: string
  briefTitle: string
  runId: string
  status: 'building' | 'running' | 'done' | 'failed'
}> = {}) {
  return {
    id: overrides.id ?? 'entry-1',
    idea: overrides.idea ?? 'Build something cool',
    briefId: 'brief-1',
    briefTitle: overrides.briefTitle ?? 'Cool Project',
    runId: overrides.runId ?? 'run-1',
    workItemCount: 3,
    taskCount: 5,
    status: (overrides.status ?? 'building') as 'building' | 'running' | 'done' | 'failed',
    createdAt: '2026-05-19T00:00:00Z',
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('idea-history-store', () => {
  beforeEach(() => {
    mockStore = '[]'
    // Reset all mocks (clears calls AND implementations), then re-apply defaults
    vi.resetAllMocks()
    fsMock.existsSync.mockReturnValue(true)
    fsMock.readFileSync.mockImplementation(() => mockStore)
  })

  it('readIdeaHistory returns empty array when file does not exist', async () => {
    fsMock.existsSync.mockReturnValue(false)
    vi.resetModules()
    const { readIdeaHistory } = await import('./idea-history-store')
    expect(readIdeaHistory()).toEqual([])
  })

  it('appendIdeaHistory prepends new entry', async () => {
    const existing = makeEntry({ id: 'old', briefTitle: 'Old Project' })
    mockStore = JSON.stringify([existing])

    vi.resetModules()
    const { appendIdeaHistory, readIdeaHistory } = await import('./idea-history-store')

    const newEntry = makeEntry({ id: 'new', briefTitle: 'New Project' })
    appendIdeaHistory(newEntry)

    // readIdeaHistory should now read from the updated mock (via writeFileSync)
    const written = JSON.parse(String(fsMock.writeFileSync.mock.calls[0]![1])) as Array<{ id: string }>
    expect(written[0].id).toBe('new')
    expect(written[1].id).toBe('old')
  })

  it('appendIdeaHistory caps at 50 entries', async () => {
    const entries = Array.from({ length: 50 }, (_, i) => makeEntry({ id: `e-${i}` }))
    mockStore = JSON.stringify(entries)

    vi.resetModules()
    const { appendIdeaHistory } = await import('./idea-history-store')

    appendIdeaHistory(makeEntry({ id: 'overflow' }))

    const written = JSON.parse(String(fsMock.writeFileSync.mock.calls[0]![1])) as unknown[]
    expect(written).toHaveLength(50)
  })

  it('readIdeaHistory respects limit', async () => {
    const entries = Array.from({ length: 10 }, (_, i) => makeEntry({ id: `e-${i}` }))
    mockStore = JSON.stringify(entries)

    vi.resetModules()
    const { readIdeaHistory } = await import('./idea-history-store')

    expect(readIdeaHistory(3)).toHaveLength(3)
  })

  it('updateIdeaHistoryStatus updates matching entry', async () => {
    mockStore = JSON.stringify([makeEntry({ runId: 'run-abc', status: 'building' })])

    vi.resetModules()
    const { updateIdeaHistoryStatus } = await import('./idea-history-store')

    updateIdeaHistoryStatus('run-abc', 'done')

    const written = JSON.parse(String(fsMock.writeFileSync.mock.calls[0]![1])) as Array<{ status: string }>
    expect(written[0].status).toBe('done')
  })

  it('updateIdeaHistoryStatus does nothing if runId not found', async () => {
    mockStore = JSON.stringify([makeEntry({ runId: 'run-1' })])

    vi.resetModules()
    const { updateIdeaHistoryStatus } = await import('./idea-history-store')

    updateIdeaHistoryStatus('nonexistent-run', 'done')

    // writeFileSync should NOT have been called since nothing changed
    expect(fsMock.writeFileSync).not.toHaveBeenCalled()
  })

  it('appendIdeaHistory uses atomic write (tmp → rename)', async () => {
    vi.resetModules()
    const { appendIdeaHistory } = await import('./idea-history-store')

    appendIdeaHistory(makeEntry())

    const writePath = String(fsMock.writeFileSync.mock.calls[0]![0])
    const renameSrc = String(fsMock.renameSync.mock.calls[0]![0])
    const renameDst = String(fsMock.renameSync.mock.calls[0]![1])

    expect(writePath).toContain('.tmp')
    expect(renameSrc).toContain('.tmp')
    expect(renameDst).not.toContain('.tmp')
    expect(renameDst).toContain('idea-history.json')
  })
})
