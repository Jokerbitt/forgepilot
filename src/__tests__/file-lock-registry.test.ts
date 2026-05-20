import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'

// `generateForbiddenFilesBlock` reads BOTH the legacy file-lock store and the
// modern scope-lock registry (config/agent-scope.json). The file-lock tests
// only exercise legacy behaviour, so mock scope-lock to return no claims —
// otherwise an unrelated live developer/agent claim makes "no locks" untrue.
vi.mock('../lib/agents/scope-lock', () => ({
  getActiveClaims: () => [],
}))

// Use a temp lock file for tests
const TEST_LOCK_FILE = path.join(process.cwd(), 'config', 'agent-file-locks.json')

// We import after potentially setting up the file
import {
  acquireFileLocks,
  releaseFileLocks,
  getActiveLocks,
  checkConflicts,
  cleanStaleLocks,
  generateForbiddenFilesBlock,
} from '../lib/agents/file-lock-registry'

describe('file-lock-registry', () => {
  beforeEach(() => {
    // Clean up lock file before each test
    try { fs.unlinkSync(TEST_LOCK_FILE) } catch { /* ok */ }
  })

  afterEach(() => {
    try { fs.unlinkSync(TEST_LOCK_FILE) } catch { /* ok */ }
  })

  it('acquires locks when no conflicts exist', () => {
    const result = acquireFileLocks('agent-1', 'Test Agent', ['src/app/page.tsx'], 'feature/test', 'test task')
    expect(result.success).toBe(true)
    expect(result.conflicts).toHaveLength(0)
  })

  it('returns conflicts when files are already locked', () => {
    acquireFileLocks('agent-1', 'Agent 1', ['src/app/page.tsx'], 'feature/a', 'task a')
    const result = acquireFileLocks('agent-2', 'Agent 2', ['src/app/page.tsx'], 'feature/b', 'task b')
    expect(result.success).toBe(false)
    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0].agentId).toBe('agent-1')
  })

  it('releases locks and allows re-acquisition', () => {
    acquireFileLocks('agent-1', 'Agent 1', ['src/app/page.tsx'], 'feature/a', 'task a')
    releaseFileLocks('agent-1')
    const result = acquireFileLocks('agent-2', 'Agent 2', ['src/app/page.tsx'], 'feature/b', 'task b')
    expect(result.success).toBe(true)
  })

  it('checkConflicts identifies locked files', () => {
    acquireFileLocks('agent-1', 'Agent 1', ['src/app/settings/page.tsx'], 'feature/a', 'task a')
    const conflicts = checkConflicts(['src/app/settings/page.tsx', 'src/app/other.tsx'])
    expect(conflicts).toHaveLength(1)
  })

  it('checkConflicts is case-insensitive', () => {
    acquireFileLocks('agent-1', 'Agent 1', ['src/app/Settings/Page.tsx'], 'feature/a', 'task a')
    const conflicts = checkConflicts(['src/app/settings/page.tsx'])
    expect(conflicts).toHaveLength(1)
  })

  it('cleanStaleLocks removes locks older than maxAgeHours', () => {
    // Write a 90-minute-old lock — within readStore's 2h window but older than 1h
    const stale = {
      locks: [{
        agentId: 'old-agent',
        agentName: 'Old',
        files: ['src/old.tsx'],
        branch: 'feature/old',
        lockedAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(), // 90 min ago
        taskDescription: 'old task',
      }],
      lastUpdated: new Date().toISOString(),
    }
    fs.mkdirSync(path.dirname(TEST_LOCK_FILE), { recursive: true })
    fs.writeFileSync(TEST_LOCK_FILE, JSON.stringify(stale))

    // cleanStaleLocks(1) removes anything older than 1h → removes the 90min lock
    const removed = cleanStaleLocks(1)
    expect(removed).toBe(1)
    expect(getActiveLocks()).toHaveLength(0)
  })

  it('generateForbiddenFilesBlock returns empty string when no locks', () => {
    const block = generateForbiddenFilesBlock()
    expect(block).toBe('')
  })

  it('generateForbiddenFilesBlock lists locked files', () => {
    acquireFileLocks('agent-1', 'UI Agent', ['src/app/dashboard/page.tsx'], 'feature/dash', 'dashboard task')
    const block = generateForbiddenFilesBlock()
    expect(block).toContain('LOCKED FILES')
    expect(block).toContain('src/app/dashboard/page.tsx')
    expect(block).toContain('UI Agent')
  })
})
