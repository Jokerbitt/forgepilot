import fs from 'fs'
import path from 'path'
import os from 'os'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { getAgents, getAgent, upsertAgent, getAvailableAgents, pickAgentForWorkload } from './registry'
import { DEFAULT_AGENT_PROFILES } from './default-profiles'

const tmpFiles: string[] = []

beforeEach(() => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgepilot-agents-'))
  fs.mkdirSync(path.join(tmpDir, 'config'))
  tmpFiles.push(tmpDir)
  vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
})

afterEach(() => {
  vi.restoreAllMocks()
  for (const f of tmpFiles.splice(0)) {
    fs.rmSync(f, { recursive: true, force: true })
  }
})

describe('getAgents', () => {
  it('returns all default profiles on first call', () => {
    const agents = getAgents()
    expect(agents.length).toBe(DEFAULT_AGENT_PROFILES.length)
  })

  it('filters by role', () => {
    const agents = getAgents('backend-engineer')
    expect(agents.every(a => a.role === 'backend-engineer')).toBe(true)
    expect(agents.length).toBeGreaterThan(0)
  })
})

describe('getAgent', () => {
  it('returns undefined for unknown id', () => {
    expect(getAgent('nonexistent')).toBeUndefined()
  })

  it('finds agent by id', () => {
    const agent = getAgent('backend-engineer')
    expect(agent?.role).toBe('backend-engineer')
  })
})

describe('upsertAgent', () => {
  it('adds a new agent profile', () => {
    const now = new Date().toISOString()
    upsertAgent({
      id: 'custom-agent',
      displayName: 'Custom',
      role: 'qa-reviewer',
      availability: 'available',
      autonomyLevel: 'supervised-write',
      strengths: ['testing'],
      limits: [],
      preferredWorkloads: ['review'],
      allowedToolIds: ['Read'],
      skillRefs: [],
      costClass: 'metered-low',
      updatedAt: now,
    })
    const found = getAgent('custom-agent')
    expect(found?.displayName).toBe('Custom')
  })

  it('updates existing agent', () => {
    const agent = getAgent('qa-reviewer')!
    upsertAgent({ ...agent, availability: 'busy' })
    expect(getAgent('qa-reviewer')?.availability).toBe('busy')
  })
})

describe('getAvailableAgents', () => {
  it('excludes disabled/busy agents', () => {
    const agent = getAgent('backend-engineer')!
    upsertAgent({ ...agent, availability: 'offline' })
    const available = getAvailableAgents('backend-engineer')
    expect(available.every(a => a.availability === 'available')).toBe(true)
  })
})

describe('pickAgentForWorkload', () => {
  it('returns agent matching workload', () => {
    const agent = pickAgentForWorkload('embedding')
    expect(agent).toBeDefined()
    expect(agent?.preferredWorkloads).toContain('embedding')
  })

  it('returns first available agent when no workload match', () => {
    const agent = pickAgentForWorkload('nonexistent-workload')
    expect(agent).toBeDefined()
  })

  it('returns undefined when no agents available', () => {
    for (const profile of DEFAULT_AGENT_PROFILES) {
      upsertAgent({ ...profile, availability: 'offline' })
    }
    const agent = pickAgentForWorkload('coding', 'backend-engineer')
    expect(agent).toBeUndefined()
  })
})

describe('DEFAULT_AGENT_PROFILES', () => {
  it('has all 8 required roles', () => {
    const roles = DEFAULT_AGENT_PROFILES.map(p => p.role)
    expect(roles).toContain('product-planner')
    expect(roles).toContain('architect')
    expect(roles).toContain('backend-engineer')
    expect(roles).toContain('frontend-saas-designer')
    expect(roles).toContain('local-ai-worker')
    expect(roles).toContain('qa-reviewer')
    expect(roles).toContain('devops-automation')
    expect(roles).toContain('knowledge-curator')
  })

  it('all profiles have unique ids', () => {
    const ids = DEFAULT_AGENT_PROFILES.map(p => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('local-ai-worker is free-local cost class', () => {
    const worker = DEFAULT_AGENT_PROFILES.find(p => p.id === 'local-ai-worker')
    expect(worker?.costClass).toBe('free-local')
  })
})
