import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'fs'

vi.mock('fs')
const mockFs = vi.mocked(fs)

import { claimScope, releaseScope, getActiveClaims, isScopeLocked } from './scope-lock'
import type { ScopeRegistry } from './scope-lock'

const MOCK_PATTERNS_A = ['src/app/api/delegations/**']
const MOCK_PATTERNS_B = ['src/app/api/delegations/**']
const MOCK_PATTERNS_C = ['src/lib/models/**']

function mockEmptyRegistry() {
  mockFs.existsSync.mockReturnValue(false)
  mockFs.readFileSync.mockReturnValue(JSON.stringify({ claims: [], updatedAt: new Date().toISOString() }))
  mockFs.writeFileSync.mockImplementation(() => undefined)
  mockFs.renameSync.mockImplementation(() => undefined)
  mockFs.mkdirSync.mockImplementation(() => undefined)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockEmptyRegistry()
})

describe('scope-lock', () => {
  it('claims scope when registry is empty', () => {
    const result = claimScope('agent-1', 'claude-code', 'M51', 'feature/m51', MOCK_PATTERNS_A)
    expect(result.success).toBe(true)
    expect(result.message).toContain('M51')
  })

  it('rejects conflicting scope claim from different agent', () => {
    // First claim succeeds
    const reg: ScopeRegistry = { claims: [], updatedAt: new Date().toISOString() }
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const existingClaim = {
      agentId: 'agent-1', agentType: 'claude-code' as const,
      milestone: 'M51', branch: 'feature/m51',
      filePatterns: MOCK_PATTERNS_A,
      claimedAt: new Date().toISOString(), expiresAt: future,
    }
    reg.claims.push(existingClaim)
    mockFs.existsSync.mockReturnValue(true)
    mockFs.readFileSync.mockReturnValue(JSON.stringify(reg))

    // Second agent tries to claim same patterns
    const result = claimScope('agent-2', 'codex', 'M52', 'feature/m52', MOCK_PATTERNS_B)
    expect(result.success).toBe(false)
    expect(result.conflict?.agentId).toBe('agent-1')
  })

  it('allows non-overlapping scope claims', () => {
    const reg: ScopeRegistry = { claims: [], updatedAt: new Date().toISOString() }
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    reg.claims.push({
      agentId: 'agent-1', agentType: 'claude-code' as const,
      milestone: 'M51', branch: 'feature/m51',
      filePatterns: MOCK_PATTERNS_A,
      claimedAt: new Date().toISOString(), expiresAt: future,
    })
    mockFs.existsSync.mockReturnValue(true)
    mockFs.readFileSync.mockReturnValue(JSON.stringify(reg))

    // Different agent claims different directory
    const result = claimScope('agent-2', 'codex', 'M52', 'feature/m52', MOCK_PATTERNS_C)
    expect(result.success).toBe(true)
  })

  it('allows same agent to re-claim their scope', () => {
    const reg: ScopeRegistry = { claims: [], updatedAt: new Date().toISOString() }
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    reg.claims.push({
      agentId: 'agent-1', agentType: 'claude-code' as const,
      milestone: 'M51', branch: 'feature/m51',
      filePatterns: MOCK_PATTERNS_A,
      claimedAt: new Date().toISOString(), expiresAt: future,
    })
    mockFs.existsSync.mockReturnValue(true)
    mockFs.readFileSync.mockReturnValue(JSON.stringify(reg))

    const result = claimScope('agent-1', 'claude-code', 'M51', 'feature/m51', MOCK_PATTERNS_A)
    expect(result.success).toBe(true)
  })

  it('releases scope for an agent', () => {
    const reg: ScopeRegistry = { claims: [], updatedAt: new Date().toISOString() }
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    reg.claims.push({
      agentId: 'agent-1', agentType: 'claude-code' as const,
      milestone: 'M51', branch: 'feature/m51',
      filePatterns: MOCK_PATTERNS_A,
      claimedAt: new Date().toISOString(), expiresAt: future,
    })
    mockFs.existsSync.mockReturnValue(true)
    mockFs.readFileSync.mockReturnValue(JSON.stringify(reg))

    const released = releaseScope('agent-1')
    expect(released).toBe(true)
    expect(mockFs.renameSync).toHaveBeenCalled()
  })

  it('auto-expires stale claims', () => {
    const reg: ScopeRegistry = { claims: [], updatedAt: new Date().toISOString() }
    // Expired claim (in the past)
    reg.claims.push({
      agentId: 'agent-old', agentType: 'claude-code' as const,
      milestone: 'M01', branch: 'feature/m01',
      filePatterns: MOCK_PATTERNS_A,
      claimedAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // expired 1h ago
    })
    mockFs.existsSync.mockReturnValue(true)
    mockFs.readFileSync.mockReturnValue(JSON.stringify(reg))

    // New agent should be able to claim same patterns
    const result = claimScope('agent-new', 'claude-code', 'M51', 'feature/m51', MOCK_PATTERNS_A)
    expect(result.success).toBe(true)
  })
})
