import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  exportSettingsBundle,
  importSettingsBundle,
  BUNDLE_FILES,
  type SettingsBundle,
} from './settings-bundle'

const mockFiles: Map<string, string> = new Map()

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn((p: string) => mockFiles.has(p)),
    readFileSync: vi.fn((p: string) => {
      const content = mockFiles.get(p)
      if (content === undefined) throw new Error(`ENOENT: ${p}`)
      return content
    }),
    writeFileSync: vi.fn(),
    renameSync: vi.fn(),
    mkdirSync: vi.fn(),
  },
}))

const configDir = `${process.cwd()}/config`

function filePath(name: string): string {
  return `${configDir}/${name}`
}

beforeEach(() => {
  mockFiles.clear()
  vi.clearAllMocks()
})

describe('exportSettingsBundle', () => {
  it('includes only BUNDLE_FILES that exist', () => {
    mockFiles.set(filePath('nba-settings.json'), JSON.stringify({ approvalMode: 'manual' }))
    mockFiles.set(filePath('autonomous-config.json'), JSON.stringify({ enabled: true }))

    const bundle = exportSettingsBundle()

    expect(bundle.version).toBe(1)
    expect(bundle.exportedAt).toBeTruthy()
    expect(Object.keys(bundle.configs)).toContain('nba-settings.json')
    expect(Object.keys(bundle.configs)).toContain('autonomous-config.json')
  })

  it('omits files that do not exist', () => {
    mockFiles.set(filePath('nba-settings.json'), JSON.stringify({ approvalMode: 'auto' }))
    // notification-preferences.json not in mockFiles

    const bundle = exportSettingsBundle()

    expect(bundle.configs['nba-settings.json']).toBeDefined()
    expect(bundle.configs['notification-preferences.json']).toBeUndefined()
  })

  it('never includes blocked files even if present on disk', () => {
    mockFiles.set(filePath('api-keys.json'), JSON.stringify({ GITHUB_TOKEN: 'secret' }))
    mockFiles.set(filePath('processing-ledger.json'), JSON.stringify([]))

    const bundle = exportSettingsBundle()

    expect(bundle.configs['api-keys.json']).toBeUndefined()
    expect(bundle.configs['processing-ledger.json']).toBeUndefined()
  })

  it('preserves config structure in bundle', () => {
    const config = { approvalMode: 'manual', models: ['claude-3-5-sonnet'] }
    mockFiles.set(filePath('nba-settings.json'), JSON.stringify(config))

    const bundle = exportSettingsBundle()

    expect(bundle.configs['nba-settings.json']).toEqual(config)
  })
})

describe('importSettingsBundle', () => {
  function makeBundle(configs: Record<string, unknown>): SettingsBundle {
    return { version: 1, exportedAt: '2026-01-01T00:00:00.000Z', configs }
  }

  it('writes allowed config files and reports imported list', () => {
    const bundle = makeBundle({
      'nba-settings.json': { approvalMode: 'auto' },
      'autonomous-config.json': { enabled: false },
    })

    const result = importSettingsBundle(bundle)

    expect(result.errors).toHaveLength(0)
    expect(result.imported).toContain('nba-settings.json')
    expect(result.imported).toContain('autonomous-config.json')
  })

  it('skips blocked files and reports in skipped list', () => {
    const bundle = makeBundle({
      'api-keys.json': { GITHUB_TOKEN: 'ghp_secret' },
      'nba-settings.json': { approvalMode: 'manual' },
    })

    const result = importSettingsBundle(bundle)

    expect(result.skipped).toContain('api-keys.json')
    expect(result.imported).toContain('nba-settings.json')
  })

  it('skips unknown files not in BUNDLE_FILES', () => {
    const bundle = makeBundle({
      'custom-thing.json': { foo: 'bar' },
      'nba-settings.json': { approvalMode: 'manual' },
    })

    const result = importSettingsBundle(bundle)

    expect(result.skipped).toContain('custom-thing.json')
    expect(result.imported).toContain('nba-settings.json')
  })

  it('returns error for unsupported version', () => {
    const bundle = { version: 2, exportedAt: '2026-01-01T00:00:00.000Z', configs: {} } as unknown as SettingsBundle

    const result = importSettingsBundle(bundle)

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('Unsupported bundle version')
  })

  it('returns empty imported list for empty configs', () => {
    const bundle = makeBundle({})

    const result = importSettingsBundle(bundle)

    expect(result.imported).toHaveLength(0)
    expect(result.errors).toHaveLength(0)
  })
})

describe('BUNDLE_FILES', () => {
  it('does not include api-keys.json', () => {
    expect(BUNDLE_FILES).not.toContain('api-keys.json')
  })

  it('includes nba-settings.json', () => {
    expect(BUNDLE_FILES).toContain('nba-settings.json')
  })
})
