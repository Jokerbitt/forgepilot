import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'

// Use a temp directory so tests don't touch real config
let tmpDir: string

vi.mock('@/lib/config/paths', () => ({
  getConfigPath: (filename: string) => path.join(tmpDir, filename),
  getDataDir: () => tmpDir,
}))

// Import after mock setup
import {
  getAutonomousConfig,
  saveAutonomousConfig,
  riskClassFitsThreshold,
} from '@/lib/config/autonomous-config'

describe('autonomous-config', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgepilot-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    vi.resetModules()
  })

  it('getAutonomousConfig returns DEFAULT_CONFIG when no config file exists', () => {
    const config = getAutonomousConfig()
    expect(config.enabled).toBe(false)
    expect(config.autoApproveDelegations).toBe(false)
    expect(config.autoExecuteOnApproval).toBe(true)
    expect(config.riskThreshold).toBe('low')
    expect(config.lastEnabledAt).toBeUndefined()
    expect(config.lastDisabledAt).toBeUndefined()
  })

  it('saveAutonomousConfig persists enabled=true and sets lastEnabledAt', () => {
    const before = new Date().toISOString()
    const saved = saveAutonomousConfig({ enabled: true })
    const after = new Date().toISOString()

    expect(saved.enabled).toBe(true)
    expect(saved.lastEnabledAt).toBeDefined()
    expect(saved.lastEnabledAt! >= before).toBe(true)
    expect(saved.lastEnabledAt! <= after).toBe(true)

    // Verify it's actually written to disk
    const reloaded = getAutonomousConfig()
    expect(reloaded.enabled).toBe(true)
    expect(reloaded.lastEnabledAt).toBe(saved.lastEnabledAt)
  })

  it('saveAutonomousConfig persists riskThreshold correctly', () => {
    saveAutonomousConfig({ riskThreshold: 'medium' })
    const config = getAutonomousConfig()
    expect(config.riskThreshold).toBe('medium')

    saveAutonomousConfig({ riskThreshold: 'high' })
    const config2 = getAutonomousConfig()
    expect(config2.riskThreshold).toBe('high')
  })

  it('saveAutonomousConfig sets lastDisabledAt when transitioning from enabled to disabled', () => {
    saveAutonomousConfig({ enabled: true })
    const saved = saveAutonomousConfig({ enabled: false })
    expect(saved.enabled).toBe(false)
    expect(saved.lastDisabledAt).toBeDefined()
  })

  describe('riskClassFitsThreshold', () => {
    it('never allows riskClass C regardless of threshold', () => {
      expect(riskClassFitsThreshold('C', 'low')).toBe(false)
      expect(riskClassFitsThreshold('C', 'medium')).toBe(false)
      expect(riskClassFitsThreshold('C', 'high')).toBe(false)
    })

    it('always allows riskClass A', () => {
      expect(riskClassFitsThreshold('A', 'low')).toBe(true)
      expect(riskClassFitsThreshold('A', 'medium')).toBe(true)
      expect(riskClassFitsThreshold('A', 'high')).toBe(true)
    })

    it('allows riskClass B only for medium and high thresholds', () => {
      expect(riskClassFitsThreshold('B', 'low')).toBe(false)
      expect(riskClassFitsThreshold('B', 'medium')).toBe(true)
      expect(riskClassFitsThreshold('B', 'high')).toBe(true)
    })
  })
})
