import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'fs'

vi.mock('fs')
const mockFs = vi.mocked(fs)

import {
  claimScope,
  releaseScope,
  getActiveClaims,
  isScopeLocked,
  heartbeatScope,
  getAgentsOnBranch,
  preflight,
} from './scope-lock'
import type { ScopeRegistry, ScopeClaim } from './scope-lock'

const PATTERNS_A = ['src/app/api/delegations/**']
const PATTERNS_B = ['src/app/api/delegations/**']
const PATTERNS_C = ['src/lib/models/**']
const PATTERNS_D = ['src/components/**']

function mockEmptyRegistry() {
  mockFs.existsSync.mockReturnValue(false)
  mockFs.readFileSync.mockReturnValue(JSON.stringify({ claims: [], updatedAt: new Date().toISOString() }))
  mockFs.writeFileSync.mockImplementation(() => undefined)
  mockFs.renameSync.mockImplementation(() => undefined)
  mockFs.mkdirSync.mockImplementation(() => undefined)
}

function mockRegistryWith(claims: ScopeClaim[]) {
  const reg: ScopeRegistry = { claims, updatedAt: new Date().toISOString() }
  mockFs.existsSync.mockReturnValue(true)
  mockFs.readFileSync.mockReturnValue(JSON.stringify(reg))
  mockFs.writeFileSync.mockImplementation(() => undefined)
  mockFs.renameSync.mockImplementation(() => undefined)
  mockFs.mkdirSync.mockImplementation(() => undefined)
}

function makeClaim(overrides: Partial<ScopeClaim> = {}): ScopeClaim {
  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
  return {
    agentId: 'agent-1',
    agentType: 'claude-code',
    milestone: 'M51',
    branch: 'feature/m51',
    filePatterns: PATTERNS_A,
    claimedAt: new Date().toISOString(),
    expiresAt: future,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockEmptyRegistry()
})

describe('scope-lock — basic claims', () => {
  it('claims scope when registry is empty', () => {
    const result = claimScope('agent-1', 'claude-code', 'M51', 'feature/m51', PATTERNS_A)
    expect(result.success).toBe(true)
    expect(result.message).toContain('M51')
  })

  it('rejects conflicting scope claim from different agent (file overlap)', () => {
    mockRegistryWith([makeClaim()])
    const result = claimScope('agent-2', 'codex', 'M52', 'feature/m52', PATTERNS_B)
    expect(result.success).toBe(false)
    expect(result.conflict?.agentId).toBe('agent-1')
    expect(result.conflictReason).toBe('file-overlap')
  })

  it('allows non-overlapping scope claims on different branches', () => {
    mockRegistryWith([makeClaim()])
    const result = claimScope('agent-2', 'codex', 'M52', 'feature/m52', PATTERNS_C)
    expect(result.success).toBe(true)
  })

  it('allows same agent to re-claim their scope', () => {
    mockRegistryWith([makeClaim()])
    const result = claimScope('agent-1', 'claude-code', 'M51', 'feature/m51', PATTERNS_A)
    expect(result.success).toBe(true)
  })

  it('releases scope for an agent', () => {
    mockRegistryWith([makeClaim()])
    const released = releaseScope('agent-1')
    expect(released).toBe(true)
    expect(mockFs.renameSync).toHaveBeenCalled()
  })

  it('auto-expires stale claims', () => {
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    mockRegistryWith([makeClaim({ agentId: 'agent-old', expiresAt: past, claimedAt: past })])
    const result = claimScope('agent-new', 'claude-code', 'M51', 'feature/m51', PATTERNS_A)
    expect(result.success).toBe(true)
  })
})

describe('scope-lock — branch isolation', () => {
  it('blocks a second agent on the same branch even with non-overlapping files', () => {
    mockRegistryWith([makeClaim()])
    const result = claimScope('agent-2', 'codex', 'M52', 'feature/m51', PATTERNS_C)
    expect(result.success).toBe(false)
    expect(result.conflictReason).toBe('branch-occupied')
    expect(result.message).toContain("feature/m51")
  })

  it('allows two agents on the same branch when shareBranch=true is passed', () => {
    mockRegistryWith([makeClaim({ shareBranch: true })])
    const result = claimScope('agent-2', 'codex', 'M52', 'feature/m51', PATTERNS_C, { shareBranch: true })
    expect(result.success).toBe(true)
  })

  it('allows two agents on the same branch when only the new agent opts in (no — both must agree)', () => {
    mockRegistryWith([makeClaim()]) // first agent did NOT opt in
    const result = claimScope('agent-2', 'codex', 'M52', 'feature/m51', PATTERNS_C, { shareBranch: true })
    expect(result.success).toBe(false)
    expect(result.conflictReason).toBe('branch-occupied')
  })

  it('still blocks file overlap even when shareBranch=true', () => {
    mockRegistryWith([makeClaim({ shareBranch: true })])
    const result = claimScope('agent-2', 'codex', 'M52', 'feature/m51', PATTERNS_A, { shareBranch: true })
    expect(result.success).toBe(false)
    expect(result.conflictReason).toBe('file-overlap')
  })
})

describe('scope-lock — heartbeat', () => {
  it('renews expiresAt on heartbeat for a live claim', () => {
    const soon = new Date(Date.now() + 60 * 1000).toISOString()
    mockRegistryWith([makeClaim({ expiresAt: soon })])

    let written = ''
    mockFs.writeFileSync.mockImplementation((_p, content) => {
      written = content.toString()
    })

    const ok = heartbeatScope('agent-1', 30)
    expect(ok).toBe(true)

    const parsed = JSON.parse(written) as ScopeRegistry
    const updated = parsed.claims.find(c => c.agentId === 'agent-1')
    expect(updated?.lastHeartbeatAt).toBeDefined()
    expect(new Date(updated!.expiresAt).getTime()).toBeGreaterThan(new Date(soon).getTime())
  })

  it('returns false when heartbeating an unknown agent', () => {
    mockEmptyRegistry()
    expect(heartbeatScope('ghost-agent')).toBe(false)
  })

  it('returns false when heartbeating an already-expired claim', () => {
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    mockRegistryWith([makeClaim({ expiresAt: past, claimedAt: past })])
    expect(heartbeatScope('agent-1')).toBe(false)
  })
})

describe('scope-lock — pid liveness', () => {
  it('treats a claim with a dead pid as stale and reaps it', () => {
    // pid 1 is init/launchd — always alive. Use a very large pid unlikely to exist.
    const deadPid = 999_999_999
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    mockRegistryWith([makeClaim({ pid: deadPid, expiresAt: future })])

    const claims = getActiveClaims()
    expect(claims).toHaveLength(0)
  })

  it('keeps a claim alive when pid is the current process', () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    mockRegistryWith([makeClaim({ pid: process.pid, expiresAt: future })])

    const claims = getActiveClaims()
    expect(claims).toHaveLength(1)
    expect(claims[0].pid).toBe(process.pid)
  })
})

describe('scope-lock — branch + preflight introspection', () => {
  it('lists agents currently on a branch (excluding caller)', () => {
    mockRegistryWith([
      makeClaim({ agentId: 'a1' }),
      makeClaim({ agentId: 'a2', filePatterns: PATTERNS_D, branch: 'feature/m51' }),
    ])
    const onBranch = getAgentsOnBranch('feature/m51', 'a1')
    expect(onBranch.map(c => c.agentId)).toEqual(['a2'])
  })

  it('preflight returns ok=true when branch is clear and no overlap', () => {
    mockEmptyRegistry()
    const result = preflight('feature/new', PATTERNS_C)
    expect(result.ok).toBe(true)
    expect(result.recommendation).toContain('Clear')
  })

  it('preflight flags file overlap before branch occupation', () => {
    mockRegistryWith([makeClaim()])
    const result = preflight('feature/m51', PATTERNS_A)
    expect(result.ok).toBe(false)
    expect(result.overlappingClaims).toHaveLength(1)
    expect(result.recommendation).toContain('Adjust file scope')
  })

  it('preflight recommends a new branch when branch is occupied but files are clean', () => {
    mockRegistryWith([makeClaim()])
    const result = preflight('feature/m51', PATTERNS_C)
    expect(result.ok).toBe(false)
    expect(result.agentsOnBranch).toHaveLength(1)
    expect(result.recommendation).toContain('separate branch')
  })
})

describe('scope-lock — file pattern overlap precision', () => {
  it('treats `src/lib/agents/**` and `src/lib/agents/foo.ts` as overlapping', () => {
    mockRegistryWith([makeClaim({ filePatterns: ['src/lib/agents/**'] })])
    const result = claimScope('agent-2', 'codex', 'M52', 'feature/m52', ['src/lib/agents/foo.ts'])
    expect(result.success).toBe(false)
    expect(result.conflictReason).toBe('file-overlap')
  })

  it('does NOT treat `src/lib/agents/**` and `src/lib/other.ts` as overlapping (sibling file)', () => {
    mockRegistryWith([makeClaim({ filePatterns: ['src/lib/agents/**'] })])
    const result = claimScope('agent-2', 'codex', 'M52', 'feature/m52', ['src/lib/other.ts'])
    expect(result.success).toBe(true)
  })

  it('does NOT treat `src/lib/foo.ts` and `src/lib/bar.ts` as overlapping (different files)', () => {
    mockRegistryWith([makeClaim({ filePatterns: ['src/lib/foo.ts'] })])
    const result = claimScope('agent-2', 'codex', 'M52', 'feature/m52', ['src/lib/bar.ts'])
    expect(result.success).toBe(true)
  })

  it('treats two overlapping wildcards as conflicting (`src/lib/**` vs `src/lib/agents/**`)', () => {
    mockRegistryWith([makeClaim({ filePatterns: ['src/lib/**'] })])
    const result = claimScope('agent-2', 'codex', 'M52', 'feature/m52', ['src/lib/agents/**'])
    expect(result.success).toBe(false)
    expect(result.conflictReason).toBe('file-overlap')
  })

  it('treats identical concrete file paths as conflicting', () => {
    mockRegistryWith([makeClaim({ filePatterns: ['src/lib/foo.ts'] })])
    const result = claimScope('agent-2', 'codex', 'M52', 'feature/m52', ['src/lib/foo.ts'])
    expect(result.success).toBe(false)
    expect(result.conflictReason).toBe('file-overlap')
  })
})

describe('scope-lock — isScopeLocked', () => {
  it('returns null when no agent holds the pattern', () => {
    mockEmptyRegistry()
    expect(isScopeLocked('src/lib/whatever.ts')).toBeNull()
  })

  it('returns the claim when an agent holds an overlapping pattern', () => {
    mockRegistryWith([makeClaim()])
    const claim = isScopeLocked('src/app/api/delegations/foo.ts')
    expect(claim).not.toBeNull()
    expect(claim?.agentId).toBe('agent-1')
  })
})
