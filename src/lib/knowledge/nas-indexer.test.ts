import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fs before importing the indexer
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}))

// Mock store functions
vi.mock('./store', () => ({
  upsertSource: vi.fn(s => s),
  upsertItem: vi.fn(i => i),
  upsertCard: vi.fn(c => c),
  getSources: vi.fn(() => []),
  getItems: vi.fn(() => []),
}))

import * as fs from 'fs'
import { indexNasFiles, indexSingleFile } from './nas-indexer'

const NAS_ROOT = '/Volumes/Sven/NAS/Codex/KI Betriebssystem'

function mockNasFile(name: string, content: string) {
  vi.mocked(fs.statSync).mockImplementation((p) => {
    return { isFile: () => String(p).endsWith('.md'), isDirectory: () => false } as ReturnType<typeof fs.statSync>
  })
  vi.mocked(fs.readdirSync).mockImplementation((dir) => {
    if (String(dir) === NAS_ROOT) return [name] as unknown as ReturnType<typeof fs.readdirSync>
    return [] as unknown as ReturnType<typeof fs.readdirSync>
  })
  vi.mocked(fs.readFileSync).mockImplementation((p) => {
    if (String(p) === `${NAS_ROOT}/${name}`) return content
    return '{}'
  })
}

beforeEach(async () => {
  vi.resetAllMocks()
  vi.mocked(fs.existsSync).mockReturnValue(true)
  vi.mocked(fs.writeFileSync).mockImplementation(() => {})
  vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
  // Restore default mock return values after resetAllMocks
  const { getSources, getItems } = await import('./store')
  vi.mocked(getSources).mockReturnValue([])
  vi.mocked(getItems).mockReturnValue([])
})

describe('indexNasFiles', () => {
  it('returns error when neither NAS nor SecondBrain is reachable', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    const result = await indexNasFiles()
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toContain('Keine Wissensquelle erreichbar')
  })

  it('indexes a markdown file and creates source + item + card', async () => {
    const content = `# Test Doc\n\nSome intro text that is long enough.\n\n## Section One\n\nThis section has meaningful content about the system architecture.`
    mockNasFile('00_START_HERE.md', content)

    const { upsertSource, upsertItem, upsertCard } = await import('./store')
    const result = await indexNasFiles()

    expect(result.sourcesIndexed).toBe(1)
    expect(result.itemsIndexed).toBe(1)
    expect(result.cardsCreated).toBeGreaterThanOrEqual(1)
    expect(upsertSource).toHaveBeenCalled()
    expect(upsertItem).toHaveBeenCalled()
    expect(upsertCard).toHaveBeenCalled()
  })

  it('skips unchanged files (same hash)', async () => {
    const content = `# Doc\n\nContent stays the same.`
    mockNasFile('01_TEST.md', content)

    // Simulate existing source with matching hash
    const hash = require('crypto').createHash('sha256').update(content).digest('hex').slice(0, 16)
    const { getSources } = await import('./store')
    vi.mocked(getSources).mockReturnValue([{
      id: 'existing-id',
      type: 'nas',
      name: '01_TEST',
      path: `${NAS_ROOT}/01_TEST.md`,
      hash,
      privacyClass: 'internal',
      lastFetched: '2026-01-01T00:00:00Z',
      freshnessTtlHours: 168,
      isStale: false,
      metadata: {},
    }])

    const result = await indexNasFiles()
    expect(result.skipped).toBe(1)
    expect(result.sourcesIndexed).toBe(0)
  })

  it('skips credential files instead of storing sensitive content', async () => {
    const content = `# Credentials\n\nANTHROPIC_API_KEY=secret-value`
    mockNasFile('FORGEPILOT-SETTINGS-CREDENTIALS.md', content)

    const { upsertSource, upsertItem, upsertCard } = await import('./store')
    const result = await indexNasFiles()

    expect(result.sensitiveSkipped).toBe(1)
    expect(result.sourcesIndexed).toBe(0)
    expect(upsertSource).not.toHaveBeenCalled()
    expect(upsertItem).not.toHaveBeenCalled()
    expect(upsertCard).not.toHaveBeenCalled()
  })

  it('creates intro card when file has no H2 sections', async () => {
    const content = `# Simple Doc\n\nThis is a document without any H2 headings but has enough content to create a card from.`
    mockNasFile('simple.md', content)

    const result = await indexNasFiles()
    expect(result.cardsCreated).toBe(1)
  })

  it('infers correct tags for ADR files', async () => {
    const content = `# ADR-001\n\nSome content.\n\n## Entscheidung\n\nWir entscheiden uns für lokale Modelle.`
    mockNasFile('ADR-001-test.md', content)

    const { upsertCard } = await import('./store')
    await indexNasFiles()

    const calls = vi.mocked(upsertCard).mock.calls
    const tags = calls[0]?.[0]?.tags ?? []
    expect(tags).toContain('adr')
  })

  it('indexes SecondBrain files when NAS root is missing but SecondBrain is reachable', async () => {
    const SECONDBRAIN = '/Volumes/Sven/NAS/SecondBrain'
    const knowledgeDir = `${SECONDBRAIN}/02_Knowledge`
    const filePath = `${knowledgeDir}/Claude-Code-Standard.md`
    const content = `# Claude Code Standard\n\nThis document describes standards.\n\n## Rules\n\nAlways write tests.`

    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const s = String(p)
      if (s === NAS_ROOT) return false        // NAS not reachable
      if (s === SECONDBRAIN) return true      // SecondBrain reachable
      if (s === knowledgeDir) return true
      return true
    })
    vi.mocked(fs.readdirSync).mockImplementation((dir) => {
      const d = String(dir)
      if (d === knowledgeDir) return ['Claude-Code-Standard.md'] as unknown as ReturnType<typeof fs.readdirSync>
      return [] as unknown as ReturnType<typeof fs.readdirSync>
    })
    vi.mocked(fs.statSync).mockImplementation((p) => {
      return { isFile: () => String(p).endsWith('.md'), isDirectory: () => false } as ReturnType<typeof fs.statSync>
    })
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      if (String(p) === filePath) return content
      return '{}'
    })

    const { upsertSource } = await import('./store')
    const result = await indexNasFiles()

    expect(result.errors).toHaveLength(0)
    expect(result.sourcesIndexed).toBeGreaterThanOrEqual(1)
    const sourceCalls = vi.mocked(upsertSource).mock.calls
    const sourceMetadata = sourceCalls[0]?.[0]?.metadata as { indexedFrom?: string } | undefined
    expect(sourceMetadata?.indexedFrom).toBe('secondbrain-indexer')
  })

  it('tags SecondBrain cards with secondbrain source tag', async () => {
    const SECONDBRAIN = '/Volumes/Sven/NAS/SecondBrain'
    const filePath = `${SECONDBRAIN}/02_Knowledge/troubleshooting.md`
    const content = `# Troubleshooting Guide\n\nHelps resolve issues.\n\n## Docker Problems\n\nRestart the container to resolve networking issues and clear cached state from previous runs.`

    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const s = String(p)
      return s !== NAS_ROOT
    })
    vi.mocked(fs.readdirSync).mockImplementation((dir) => {
      if (String(dir) === `${SECONDBRAIN}/02_Knowledge`) {
        return ['troubleshooting.md'] as unknown as ReturnType<typeof fs.readdirSync>
      }
      return [] as unknown as ReturnType<typeof fs.readdirSync>
    })
    vi.mocked(fs.statSync).mockImplementation((p) => ({
      isFile: () => String(p).endsWith('.md'),
      isDirectory: () => false,
    } as ReturnType<typeof fs.statSync>))
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      if (String(p) === filePath) return content
      return '{}'
    })

    const { upsertCard } = await import('./store')
    await indexNasFiles()

    const tags = vi.mocked(upsertCard).mock.calls[0]?.[0]?.tags ?? []
    expect(tags).toContain('secondbrain')
    expect(tags).not.toContain('nas')
  })
})

describe('indexSingleFile', () => {
  const FILE_PATH = `${NAS_ROOT}/single-test.md`

  it('returns error when file does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    const result = indexSingleFile(FILE_PATH)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toContain('nicht gefunden')
  })

  it('indexes a single file and creates source + item + card', async () => {
    const content = `# Single File\n\nIntro text that is long enough.\n\n## Section\n\nThis section has content about the topic.`
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      if (String(p) === FILE_PATH) return content
      return '{}'
    })

    const { upsertSource, upsertItem, upsertCard } = await import('./store')
    const result = indexSingleFile(FILE_PATH)

    expect(result.sourcesIndexed).toBe(1)
    expect(result.itemsIndexed).toBe(1)
    expect(result.cardsCreated).toBeGreaterThanOrEqual(1)
    expect(upsertSource).toHaveBeenCalled()
    expect(upsertItem).toHaveBeenCalled()
    expect(upsertCard).toHaveBeenCalled()
  })

  it('skips unchanged file (same hash)', async () => {
    const content = `# Unchanged\n\nSame content.`
    const hash = require('crypto').createHash('sha256').update(content).digest('hex').slice(0, 16)
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockImplementation(() => content)

    const { getSources } = await import('./store')
    vi.mocked(getSources).mockReturnValue([{
      id: 'existing-single',
      type: 'nas',
      name: 'single-test',
      path: FILE_PATH,
      hash,
      privacyClass: 'internal',
      lastFetched: '2026-01-01T00:00:00Z',
      freshnessTtlHours: 168,
      isStale: false,
      metadata: {},
    }])

    const result = indexSingleFile(FILE_PATH)
    expect(result.skipped).toBe(1)
    expect(result.sourcesIndexed).toBe(0)
  })
})

describe('getIndexStatus', () => {
  it('returns zero staleSources and null lastIndexedAt when store is empty', async () => {
    const { getSources } = await import('./store')
    vi.mocked(getSources).mockReturnValue([])
    const { getIndexStatus } = await import('./nas-indexer')
    const status = getIndexStatus()
    expect(status.sourcesTotal).toBe(0)
    expect(status.staleSources).toBe(0)
    expect(status.lastIndexedAt).toBeNull()
  })

  it('counts stale sources correctly', async () => {
    const { getSources } = await import('./store')
    vi.mocked(getSources).mockReturnValue([
      {
        id: 's1', type: 'nas', name: 'fresh', path: '/a', hash: 'x',
        privacyClass: 'internal', lastFetched: new Date().toISOString(),
        freshnessTtlHours: 168, isStale: false, metadata: {},
      },
      {
        id: 's2', type: 'nas', name: 'stale', path: '/b', hash: 'y',
        privacyClass: 'internal', lastFetched: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
        freshnessTtlHours: 168, isStale: false, metadata: {},
      },
    ])
    const { getIndexStatus } = await import('./nas-indexer')
    const status = getIndexStatus()
    expect(status.sourcesTotal).toBe(2)
    expect(status.staleSources).toBe(1)
    expect(status.lastIndexedAt).toBeTruthy()
  })
})
