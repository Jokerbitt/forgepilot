import { describe, it, expect, vi, beforeEach } from 'vitest'
import { saveSnapshot, getBriefVersions, getBriefVersion, diffBriefs } from './brief-versions'
import type { ProjectBrief } from '@/lib/models/project-brief'

const mockFiles: Map<string, string> = new Map()

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn((p: string) => mockFiles.has(p)),
    readFileSync: vi.fn((p: string) => {
      const c = mockFiles.get(p)
      if (c === undefined) throw new Error(`ENOENT: ${p}`)
      return c
    }),
    writeFileSync: vi.fn((p: string, content: string) => { mockFiles.set(p, content) }),
    renameSync: vi.fn((src: string, dst: string) => {
      const c = mockFiles.get(src)
      if (c !== undefined) { mockFiles.set(dst, c); mockFiles.delete(src) }
    }),
    mkdirSync: vi.fn(),
  },
}))

function makeBrief(overrides: Partial<ProjectBrief> = {}): ProjectBrief {
  return {
    id: 'brief-1',
    title: 'Test Brief',
    status: 'draft',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    rawIdea: 'Build something great',
    problemStatement: 'Problem here',
    targetAudience: 'Developers',
    desiredOutcome: 'Great product',
    constraints: ['Budget: $10k'],
    scope: 'standard',
    researchMode: 'quick',
    privacyMode: 'local',
    requirements: [],
    useCases: [],
    nonGoals: [],
    risks: [],
    researchRunIds: [],
    researchBriefDraft: {
      title: '',
      mode: 'quick',
      privacyMode: 'local',
      preferredExecutor: 'agent',
      researchQuestions: [],
      searchTerms: [],
      preferredSourceTypes: [],
      excludeCriteria: [],
    },
    ...overrides,
  }
}

beforeEach(() => {
  mockFiles.clear()
  vi.clearAllMocks()
})

describe('saveSnapshot', () => {
  it('saves a version and returns it', () => {
    const brief = makeBrief()
    const version = saveSnapshot(brief, 'test snapshot')
    expect(version.briefId).toBe('brief-1')
    expect(version.label).toBe('test snapshot')
    expect(version.versionNumber).toBe(1)
    expect(version.snapshot.title).toBe('Test Brief')
  })

  it('increments versionNumber on each save', () => {
    const brief = makeBrief()
    const v1 = saveSnapshot(brief)
    const v2 = saveSnapshot(brief)
    expect(v2.versionNumber).toBe(v1.versionNumber + 1)
  })

  it('keeps only the newest 20 versions per brief', () => {
    const brief = makeBrief()
    for (let index = 0; index < 22; index += 1) {
      saveSnapshot({ ...brief, title: `Version ${index}` })
    }

    const versions = getBriefVersions('brief-1')
    expect(versions).toHaveLength(20)
    expect(versions[0].versionNumber).toBe(22)
    expect(versions.at(-1)?.versionNumber).toBe(3)
  })
})

describe('getBriefVersions', () => {
  it('returns empty array when no versions exist', () => {
    expect(getBriefVersions('no-such-brief')).toEqual([])
  })

  it('returns versions sorted by versionNumber desc (newest first)', () => {
    const brief = makeBrief()
    saveSnapshot(brief)
    saveSnapshot(brief)
    saveSnapshot(brief)
    const versions = getBriefVersions('brief-1')
    expect(versions[0].versionNumber).toBeGreaterThan(versions[1].versionNumber)
  })

  it('only returns versions for the given briefId', () => {
    saveSnapshot(makeBrief({ id: 'brief-1' }))
    saveSnapshot(makeBrief({ id: 'brief-2' }))
    const v1 = getBriefVersions('brief-1')
    expect(v1.every(v => v.briefId === 'brief-1')).toBe(true)
  })
})

describe('getBriefVersion', () => {
  it('finds a specific version by id', () => {
    const brief = makeBrief()
    const saved = saveSnapshot(brief)
    const found = getBriefVersion('brief-1', saved.versionId)
    expect(found?.versionId).toBe(saved.versionId)
  })

  it('returns null for unknown versionId', () => {
    saveSnapshot(makeBrief())
    expect(getBriefVersion('brief-1', 'nope')).toBeNull()
  })
})

describe('diffBriefs', () => {
  it('marks unchanged fields as not changed', () => {
    const brief = makeBrief()
    const diffs = diffBriefs(brief, brief)
    expect(diffs.every(d => !d.changed)).toBe(true)
  })

  it('marks changed title as changed', () => {
    const before = makeBrief({ title: 'Old title' })
    const after = makeBrief({ title: 'New title' })
    const diffs = diffBriefs(before, after)
    const titleDiff = diffs.find(d => d.field === 'title')
    expect(titleDiff?.changed).toBe(true)
    expect(titleDiff?.before).toBe('Old title')
    expect(titleDiff?.after).toBe('New title')
  })

  it('detects requirement changes', () => {
    const before = makeBrief({ requirements: [{ id: 'r1', briefId: 'brief-1', type: 'functional', title: 'Auth', description: '', priority: 'must', source: 'user_input', findingIds: [], status: 'proposed' }] })
    const after = makeBrief({ requirements: [] })
    const diffs = diffBriefs(before, after)
    const reqDiff = diffs.find(d => d.field === 'requirements')
    expect(reqDiff?.changed).toBe(true)
  })

  it('includes both changed and unchanged fields', () => {
    const before = makeBrief()
    const after = makeBrief({ title: 'Updated' })
    const diffs = diffBriefs(before, after)
    expect(diffs.length).toBeGreaterThan(1)
  })
})
