/**
 * Tests for Config Backup Routine — M161
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── fs mock ────────────────────────────────────────────────────────────────────

const { mockExistsSync, mockMkdirSync, mockReaddirSync, mockCopyFileSync,
        mockStatSync, mockUnlinkSync, mockRmdirSync } = vi.hoisted(() => ({
  mockExistsSync:    vi.fn(() => false),
  mockMkdirSync:     vi.fn(),
  mockReaddirSync:   vi.fn(() => [] as string[]),
  mockCopyFileSync:  vi.fn(),
  mockStatSync:      vi.fn(() => ({ size: 1024, birthtime: new Date('2026-05-20T08:00:00.000Z') })),
  mockUnlinkSync:    vi.fn(),
  mockRmdirSync:     vi.fn(),
}))

vi.mock('fs', () => ({
  default: {
    existsSync:   mockExistsSync,
    mkdirSync:    mockMkdirSync,
    readdirSync:  mockReaddirSync,
    copyFileSync: mockCopyFileSync,
    statSync:     mockStatSync,
    unlinkSync:   mockUnlinkSync,
    rmdirSync:    mockRmdirSync,
  },
}))

import { runBackup, listBackups, restoreBackup } from './backup'

// ── Helpers ───────────────────────────────────────────────────────────────────

function setupConfigDir(files: string[]) {
  mockReaddirSync.mockImplementation((...args: unknown[]) => {
    const p = String(args[0])
    if (p.endsWith('/config') || p.endsWith('config')) return files
    if (p.includes('backups')) return []
    return []
  })
  mockExistsSync.mockReturnValue(false)
}

// ── Tests: runBackup ──────────────────────────────────────────────────────────

describe('runBackup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExistsSync.mockReturnValue(false)
    mockReaddirSync.mockReturnValue([])
  })

  it('creates backup dir and returns backed up files', () => {
    const now = new Date('2026-05-21T10:00:00.000Z')
    mockReaddirSync.mockImplementation((...args: unknown[]) => {
      const p = String(args[0])
      if (p.endsWith('/config') || p === process.cwd() + '/config') return ['delegations.json', 'notifications.json']
      return []
    })

    const result = runBackup(now)

    expect(result.date).toBe('2026-05-21')
    expect(result.filesBackedUp).toContain('delegations.json')
    expect(result.filesBackedUp).toContain('notifications.json')
    expect(result.alreadyExisted).toBe(false)
    expect(mockMkdirSync).toHaveBeenCalled()
  })

  it('excludes non-JSON files', () => {
    const now = new Date('2026-05-21T10:00:00.000Z')
    mockReaddirSync.mockImplementation(() => ['delegations.json', 'README.md', 'settings.tmp', '.DS_Store'])

    const result = runBackup(now)

    expect(result.filesBackedUp).toContain('delegations.json')
    expect(result.filesBackedUp).not.toContain('README.md')
    expect(result.filesBackedUp).not.toContain('settings.tmp')
    expect(result.filesBackedUp).not.toContain('.DS_Store')
  })

  it('marks alreadyExisted=true when backup dir exists', () => {
    const now = new Date('2026-05-21T10:00:00.000Z')
    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockReturnValue([])

    const result = runBackup(now)

    expect(result.alreadyExisted).toBe(true)
  })

  it('records skipped files when copyFileSync throws', () => {
    const now = new Date('2026-05-21T10:00:00.000Z')
    mockReaddirSync.mockReturnValue(['delegations.json', 'broken.json'])
    mockCopyFileSync.mockImplementation((...args: unknown[]) => {
      if (String(args[0]).includes('broken')) throw new Error('EACCES')
    })

    const result = runBackup(now)

    expect(result.filesSkipped).toContain('broken.json')
    expect(result.filesBackedUp).toContain('delegations.json')
  })

  it('rotates old backups beyond MAX_BACKUPS (7)', () => {
    const now = new Date('2026-05-21T10:00:00.000Z')
    // existsSync: backups dir exists, individual date dirs do not yet exist for today
    mockExistsSync.mockImplementation((...args: unknown[]) => {
      const p = String(args[0])
      if (p.includes('backups')) return true
      return false
    })
    mockReaddirSync.mockImplementation((...args: unknown[]) => {
      const p = String(args[0])
      // BACKUPS_DIR returns 8 date dirs (including today = 9 after backup, but we set up 8)
      if (p.endsWith('backups')) {
        return [
          '2026-05-14', '2026-05-15', '2026-05-16', '2026-05-17',
          '2026-05-18', '2026-05-19', '2026-05-20', '2026-05-21',
        ]
      }
      // individual date dirs have files
      if (p.includes('2026-05-')) return ['delegations.json']
      // config dir (source files)
      return []
    })

    runBackup(now)

    // unlinkSync should be called for the oldest dir's files (2026-05-14)
    expect(mockUnlinkSync).toHaveBeenCalled()
    expect(mockRmdirSync).toHaveBeenCalled()
  })
})

// ── Tests: listBackups ────────────────────────────────────────────────────────

describe('listBackups', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns empty result when backups dir does not exist', () => {
    mockExistsSync.mockReturnValue(false)
    const result = listBackups()
    expect(result.backups).toHaveLength(0)
    expect(result.totalBackups).toBe(0)
    expect(result.oldestDate).toBeNull()
    expect(result.newestDate).toBeNull()
  })

  it('lists backups in newest-first order', () => {
    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockImplementation((...args: unknown[]) => {
      const p = String(args[0])
      if (p.includes('backups') && !p.match(/\d{4}-\d{2}-\d{2}/)) {
        return ['2026-05-19', '2026-05-20', '2026-05-21', 'ignore-me']
      }
      if (p.match(/\d{4}-\d{2}-\d{2}/)) return ['delegations.json']
      return []
    })

    const result = listBackups()

    expect(result.totalBackups).toBe(3)
    expect(result.backups[0].date).toBe('2026-05-21')
    expect(result.backups[2].date).toBe('2026-05-19')
    expect(result.newestDate).toBe('2026-05-21')
    expect(result.oldestDate).toBe('2026-05-19')
  })

  it('includes files list per backup', () => {
    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockImplementation((...args: unknown[]) => {
      const p = String(args[0])
      if (p.endsWith('backups')) return ['2026-05-21']
      if (p.includes('2026-05-21')) return ['delegations.json', 'notifications.json']
      return []
    })

    const result = listBackups()

    expect(result.backups[0].files).toContain('delegations.json')
    expect(result.backups[0].files).toContain('notifications.json')
  })
})

// ── Tests: restoreBackup ──────────────────────────────────────────────────────

describe('restoreBackup', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('throws when backup date does not exist', () => {
    mockExistsSync.mockReturnValue(false)
    expect(() => restoreBackup('2026-05-01')).toThrow('Backup not found for date: 2026-05-01')
  })

  it('copies backed-up files to config dir', () => {
    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockReturnValue(['delegations.json', 'notifications.json'])

    const restored = restoreBackup('2026-05-20')

    expect(restored).toContain('delegations.json')
    expect(restored).toContain('notifications.json')
    expect(mockCopyFileSync).toHaveBeenCalledTimes(2)
  })

  it('skips non-JSON files in backup dir', () => {
    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockReturnValue(['delegations.json', 'README.txt'])

    const restored = restoreBackup('2026-05-20')

    expect(restored).toContain('delegations.json')
    expect(restored).not.toContain('README.txt')
  })
})
