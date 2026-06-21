import fs from 'fs'
import path from 'path'
import os from 'os'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import {
  listSkills,
  getSkill,
  createSkill,
  updateSkill,
  deleteSkill,
  recordSkillOutcome,
  assembleSkillBlock,
  seedBuiltinSkills,
  type SkillMetrics,
} from './prompt-skill-registry'

const tmpDirs: string[] = []

beforeEach(() => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgepilot-skills-'))
  const configDir = path.join(tmpDir, 'config')
  fs.mkdirSync(configDir)
  tmpDirs.push(tmpDir)
  vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
})

afterEach(() => {
  vi.restoreAllMocks()
  for (const d of tmpDirs.splice(0)) {
    fs.rmSync(d, { recursive: true, force: true })
  }
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

const baseMetrics: SkillMetrics = {
  runsCount: 0,
  avgQualityScore: 0,
  avgTokensSaved: 0,
  successRate: 0,
  trend: 'unknown',
}

function makeSkillInput(overrides: Partial<Parameters<typeof createSkill>[0]> = {}) {
  return {
    name: 'test-skill',
    version: '1.0.0',
    scope: 'global' as const,
    status: 'active' as const,
    source: 'user' as const,
    description: 'A test skill',
    content: 'Do something useful.',
    isDynamic: false,
    tags: ['test'],
    metrics: { ...baseMetrics },
    ...overrides,
  }
}

// ─── listSkills ───────────────────────────────────────────────────────────────

describe('listSkills', () => {
  it('returns empty array when registry file does not exist', () => {
    expect(listSkills()).toEqual([])
  })

  it('filters by status', () => {
    createSkill(makeSkillInput({ status: 'active' }))
    createSkill(makeSkillInput({ name: 'draft-skill', status: 'draft' }))
    const active = listSkills({ status: 'active' })
    expect(active).toHaveLength(1)
    expect(active[0]!.status).toBe('active')
  })

  it('filters by source', () => {
    createSkill(makeSkillInput({ source: 'user' }))
    createSkill(makeSkillInput({ name: 'builtin-skill', source: 'builtin' }))
    const user = listSkills({ source: 'user' })
    expect(user).toHaveLength(1)
    expect(user[0]!.source).toBe('user')
  })

  it('returns global skills when filtering by a specific scope', () => {
    createSkill(makeSkillInput({ name: 'global-skill', scope: 'global' }))
    createSkill(makeSkillInput({ name: 'feature-skill', scope: 'feature' }))
    const forFeature = listSkills({ scope: 'feature' })
    // Both global + feature should appear
    expect(forFeature.length).toBe(2)
  })

  it('sorts by avgQualityScore descending', () => {
    createSkill(makeSkillInput({ name: 'low', metrics: { ...baseMetrics, avgQualityScore: 20 } }))
    createSkill(makeSkillInput({ name: 'high', metrics: { ...baseMetrics, avgQualityScore: 90 } }))
    const skills = listSkills()
    expect(skills[0]!.metrics.avgQualityScore).toBeGreaterThanOrEqual(skills[1]!.metrics.avgQualityScore)
  })
})

// ─── createSkill ──────────────────────────────────────────────────────────────

describe('createSkill', () => {
  it('assigns a UUID id', () => {
    const skill = createSkill(makeSkillInput())
    expect(skill.id).toBeTruthy()
    expect(skill.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('assigns createdAt and updatedAt timestamps', () => {
    const before = new Date().toISOString()
    const skill = createSkill(makeSkillInput())
    const after = new Date().toISOString()
    expect(skill.createdAt >= before).toBe(true)
    expect(skill.createdAt <= after).toBe(true)
    expect(skill.updatedAt).toBe(skill.createdAt)
  })

  it('persists skill to disk', () => {
    const skill = createSkill(makeSkillInput())
    const found = getSkill(skill.id)
    expect(found).not.toBeNull()
    expect(found?.name).toBe('test-skill')
  })
})

// ─── updateSkill ──────────────────────────────────────────────────────────────

describe('updateSkill', () => {
  it('updates the updatedAt timestamp', async () => {
    const skill = createSkill(makeSkillInput())
    const originalUpdatedAt = skill.updatedAt
    // Small delay to ensure timestamp differs
    await new Promise(r => setTimeout(r, 5))
    const updated = updateSkill(skill.id, { description: 'Changed description' })
    expect(updated).not.toBeNull()
    expect(updated!.updatedAt > originalUpdatedAt).toBe(true)
  })

  it('updates specified fields', () => {
    const skill = createSkill(makeSkillInput())
    const updated = updateSkill(skill.id, { status: 'deprecated' })
    expect(updated?.status).toBe('deprecated')
  })

  it('returns null for unknown id', () => {
    expect(updateSkill('nonexistent-id', { status: 'draft' })).toBeNull()
  })

  it('preserves createdAt on update', () => {
    const skill = createSkill(makeSkillInput())
    const updated = updateSkill(skill.id, { description: 'New desc' })
    expect(updated?.createdAt).toBe(skill.createdAt)
  })
})

// ─── deleteSkill ──────────────────────────────────────────────────────────────

describe('deleteSkill', () => {
  it('removes the skill from the registry', () => {
    const skill = createSkill(makeSkillInput())
    const result = deleteSkill(skill.id)
    expect(result).toBe(true)
    expect(getSkill(skill.id)).toBeNull()
    expect(listSkills()).toHaveLength(0)
  })

  it('returns false for unknown id', () => {
    expect(deleteSkill('does-not-exist')).toBe(false)
  })

  it('only removes the targeted skill', () => {
    const a = createSkill(makeSkillInput({ name: 'skill-a' }))
    const b = createSkill(makeSkillInput({ name: 'skill-b' }))
    deleteSkill(a.id)
    expect(getSkill(b.id)).not.toBeNull()
    expect(listSkills()).toHaveLength(1)
  })
})

// ─── recordSkillOutcome ───────────────────────────────────────────────────────

describe('recordSkillOutcome', () => {
  it('increments runsCount', () => {
    const skill = createSkill(makeSkillInput())
    recordSkillOutcome({ skillId: skill.id, qualityScore: 80, tokensSaved: 10, success: true, recordedAt: new Date().toISOString() })
    const updated = getSkill(skill.id)
    expect(updated?.metrics.runsCount).toBe(1)
  })

  it('computes running average for quality score', () => {
    const skill = createSkill(makeSkillInput({ metrics: { ...baseMetrics, runsCount: 1, avgQualityScore: 60 } }))
    recordSkillOutcome({ skillId: skill.id, qualityScore: 80, tokensSaved: 0, success: true, recordedAt: new Date().toISOString() })
    const updated = getSkill(skill.id)
    // avg of 60 and 80 = 70
    expect(updated?.metrics.avgQualityScore).toBe(70)
    expect(updated?.metrics.runsCount).toBe(2)
  })

  it('computes running average for tokensSaved', () => {
    const skill = createSkill(makeSkillInput({ metrics: { ...baseMetrics, runsCount: 1, avgTokensSaved: 20 } }))
    recordSkillOutcome({ skillId: skill.id, qualityScore: 50, tokensSaved: 40, success: true, recordedAt: new Date().toISOString() })
    const updated = getSkill(skill.id)
    // avg of 20 and 40 = 30
    expect(updated?.metrics.avgTokensSaved).toBe(30)
  })

  it('sets trend to improving when new score is > avg + 5', () => {
    const skill = createSkill(makeSkillInput({ metrics: { ...baseMetrics, runsCount: 1, avgQualityScore: 50 } }))
    recordSkillOutcome({ skillId: skill.id, qualityScore: 90, tokensSaved: 0, success: true, recordedAt: new Date().toISOString() })
    expect(getSkill(skill.id)?.metrics.trend).toBe('improving')
  })

  it('sets trend to declining when new score is < avg - 5', () => {
    const skill = createSkill(makeSkillInput({ metrics: { ...baseMetrics, runsCount: 1, avgQualityScore: 80 } }))
    recordSkillOutcome({ skillId: skill.id, qualityScore: 40, tokensSaved: 0, success: false, recordedAt: new Date().toISOString() })
    expect(getSkill(skill.id)?.metrics.trend).toBe('declining')
  })

  it('sets trend to stable when score is within ±5 of avg', () => {
    const skill = createSkill(makeSkillInput({ metrics: { ...baseMetrics, runsCount: 1, avgQualityScore: 70 } }))
    recordSkillOutcome({ skillId: skill.id, qualityScore: 72, tokensSaved: 0, success: true, recordedAt: new Date().toISOString() })
    expect(getSkill(skill.id)?.metrics.trend).toBe('stable')
  })

  it('updates successRate correctly', () => {
    const skill = createSkill(makeSkillInput({ metrics: { ...baseMetrics, runsCount: 3, successRate: 1.0 } }))
    recordSkillOutcome({ skillId: skill.id, qualityScore: 50, tokensSaved: 0, success: false, recordedAt: new Date().toISOString() })
    const updated = getSkill(skill.id)
    // 3 successes out of 4 runs = 0.75
    expect(updated?.metrics.successRate).toBeCloseTo(0.75)
  })

  it('is a no-op for unknown skillId', () => {
    // Should not throw
    expect(() => recordSkillOutcome({ skillId: 'ghost', qualityScore: 80, tokensSaved: 5, success: true, recordedAt: new Date().toISOString() })).not.toThrow()
  })
})

// ─── assembleSkillBlock ───────────────────────────────────────────────────────

describe('assembleSkillBlock', () => {
  it('returns empty string when no active skills exist', () => {
    expect(assembleSkillBlock('feature')).toBe('')
  })

  it('returns empty string when only draft skills exist', () => {
    createSkill(makeSkillInput({ scope: 'feature', status: 'draft' }))
    expect(assembleSkillBlock('feature')).toBe('')
  })

  it('includes active skill content', () => {
    createSkill(makeSkillInput({ scope: 'global', status: 'active', content: 'Always write tests.' }))
    const block = assembleSkillBlock('feature')
    expect(block).toContain('Always write tests.')
  })

  it('fills dynamic placeholders', () => {
    createSkill(makeSkillInput({
      scope: 'global',
      status: 'active',
      isDynamic: true,
      content: 'Failures: {{recentFailures}}',
    }))
    const block = assembleSkillBlock('feature', { recentFailures: 'No hanging awaits.' })
    expect(block).toContain('No hanging awaits.')
    expect(block).not.toContain('{{recentFailures}}')
  })

  it('wraps output in ## Skill Instructions header', () => {
    createSkill(makeSkillInput({ scope: 'global', status: 'active' }))
    const block = assembleSkillBlock('global')
    expect(block).toContain('## Skill Instructions')
  })
})

// ─── seedBuiltinSkills ────────────────────────────────────────────────────────

describe('seedBuiltinSkills', () => {
  it('creates exactly 5 builtin skills', () => {
    seedBuiltinSkills()
    expect(listSkills()).toHaveLength(5)
  })

  it('all seeded skills have source = builtin', () => {
    seedBuiltinSkills()
    for (const skill of listSkills()) {
      expect(skill.source).toBe('builtin')
    }
  })

  it('is idempotent — calling twice does not add more skills', () => {
    seedBuiltinSkills()
    seedBuiltinSkills()
    expect(listSkills()).toHaveLength(5)
  })

  it('does not seed if registry already has skills', () => {
    createSkill(makeSkillInput())
    seedBuiltinSkills()
    // Only the 1 user skill should exist — seed was skipped
    expect(listSkills()).toHaveLength(1)
  })
})

// ─── atomic writes (regression: no partial JSON) ─────────────────────────────

describe('atomic write safety', () => {
  it('does not leave a .tmp file after createSkill', () => {
    createSkill(makeSkillInput())
    const tmpFile = path.join(process.cwd(), 'config', 'prompt-skills.json.tmp')
    expect(fs.existsSync(tmpFile)).toBe(false)
  })
})
