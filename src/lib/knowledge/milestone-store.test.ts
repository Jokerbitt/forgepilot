/**
 * milestone-store tests
 *
 * Strategy: fully mock the `fs` module so no real disk I/O occurs.
 * We maintain an in-memory file system (Map<path, string>) that the mock
 * delegates to, making atomic-write (writeFileSync + renameSync) work
 * transparently.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── In-memory FS ────────────────────────────────────────────────────────────

const memFs = new Map<string, string>()

vi.mock('fs', () => {
  return {
    default: {
      existsSync: (p: string) => memFs.has(p) || p.endsWith('config') || p.endsWith('config/'),
      mkdirSync: (_p: string, _opts?: unknown) => { /* no-op: dirs always "exist" */ },
      writeFileSync: (p: string, data: string) => { memFs.set(p, data) },
      readFileSync: (p: string) => {
        const content = memFs.get(p)
        if (content === undefined) throw Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' })
        return content
      },
      renameSync: (src: string, dest: string) => {
        const data = memFs.get(src)
        if (data !== undefined) {
          memFs.set(dest, data)
          memFs.delete(src)
        }
      },
    },
    existsSync: (p: string) => memFs.has(p) || p.endsWith('config') || p.endsWith('config/'),
    mkdirSync: (_p: string, _opts?: unknown) => { /* no-op */ },
    writeFileSync: (p: string, data: string) => { memFs.set(p, data) },
    readFileSync: (p: string) => {
      const content = memFs.get(p)
      if (content === undefined) throw Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' })
      return content
    },
    renameSync: (src: string, dest: string) => {
      const data = memFs.get(src)
      if (data !== undefined) {
        memFs.set(dest, data)
        memFs.delete(src)
      }
    },
  }
})

// ─── Import AFTER mock is installed ──────────────────────────────────────────
import {
  persistGeneratedPlan,
  getMilestonesByBriefId,
  getWorkPackagesByBriefId,
  readMilestones,
  readWorkPackages,
  writeMilestones,
  writeWorkPackages,
} from './milestone-store'

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  memFs.clear()
})

describe('milestone-store', () => {
  it('persistGeneratedPlan creates milestones with generated IDs and correct briefId', () => {
    const plan = persistGeneratedPlan(
      'brief-abc',
      [{ title: 'Setup', description: 'Initial', goal: 'Repo ready', targetWeek: 1, status: 'planned' }],
      [{ milestoneIndex: 0, title: 'Init repo', description: 'Create project', definitionOfDone: ['CI green'], riskClass: 'A', priority: 'high', estimatedHours: 4, dependsOn: [], status: 'backlog', tags: [] }],
    )

    expect(plan.milestones).toHaveLength(1)
    expect(plan.milestones[0].id).toBeDefined()
    expect(plan.milestones[0].id.length).toBeGreaterThan(0)
    expect(plan.milestones[0].briefId).toBe('brief-abc')
    expect(plan.workPackages[0].briefId).toBe('brief-abc')
  })

  it('persistGeneratedPlan assigns work packages to the correct milestone by milestoneIndex', () => {
    const plan = persistGeneratedPlan(
      'brief-idx',
      [
        { title: 'M1', description: 'First', goal: 'Goal 1', targetWeek: 1, status: 'planned' },
        { title: 'M2', description: 'Second', goal: 'Goal 2', targetWeek: 2, status: 'planned' },
      ],
      [
        { milestoneIndex: 0, title: 'WP-A', description: 'Belongs to M1', definitionOfDone: ['done'], riskClass: 'A', priority: 'high', estimatedHours: 2, dependsOn: [], status: 'backlog', tags: [] },
        { milestoneIndex: 1, title: 'WP-B', description: 'Belongs to M2', definitionOfDone: ['done'], riskClass: 'B', priority: 'medium', estimatedHours: 8, dependsOn: [], status: 'backlog', tags: [] },
      ],
    )

    expect(plan.workPackages[0].milestoneId).toBe(plan.milestones[0].id)
    expect(plan.workPackages[1].milestoneId).toBe(plan.milestones[1].id)
  })

  it('persistGeneratedPlan wires workPackageIds back onto milestones', () => {
    const plan = persistGeneratedPlan(
      'brief-wire',
      [{ title: 'M1', description: 'Milestone', goal: 'Goal', targetWeek: 1, status: 'planned' }],
      [
        { milestoneIndex: 0, title: 'WP-1', description: 'First', definitionOfDone: ['done'], riskClass: 'A', priority: 'high', estimatedHours: 2, dependsOn: [], status: 'backlog', tags: [] },
        { milestoneIndex: 0, title: 'WP-2', description: 'Second', definitionOfDone: ['done'], riskClass: 'A', priority: 'low', estimatedHours: 2, dependsOn: [], status: 'backlog', tags: [] },
      ],
    )

    expect(plan.milestones[0].workPackageIds).toHaveLength(2)
    expect(plan.milestones[0].workPackageIds).toContain(plan.workPackages[0].id)
    expect(plan.milestones[0].workPackageIds).toContain(plan.workPackages[1].id)
  })

  it('getMilestonesByBriefId returns only milestones for the given brief', () => {
    persistGeneratedPlan(
      'brief-X',
      [{ title: 'X-Milestone', description: 'For X', goal: 'Goal X', targetWeek: 1, status: 'planned' }],
      [],
    )
    persistGeneratedPlan(
      'brief-Y',
      [{ title: 'Y-Milestone', description: 'For Y', goal: 'Goal Y', targetWeek: 2, status: 'planned' }],
      [],
    )

    const forX = getMilestonesByBriefId('brief-X')
    expect(forX).toHaveLength(1)
    expect(forX[0].title).toBe('X-Milestone')

    const forY = getMilestonesByBriefId('brief-Y')
    expect(forY).toHaveLength(1)
    expect(forY[0].title).toBe('Y-Milestone')
  })

  it('getWorkPackagesByBriefId returns only work packages for the given brief', () => {
    persistGeneratedPlan(
      'brief-A',
      [{ title: 'MA', description: 'M for A', goal: 'Goal', targetWeek: 1, status: 'planned' }],
      [{ milestoneIndex: 0, title: 'WP-A', description: 'For A', definitionOfDone: ['done'], riskClass: 'A', priority: 'high', estimatedHours: 4, dependsOn: [], status: 'backlog', tags: [] }],
    )
    persistGeneratedPlan(
      'brief-B',
      [{ title: 'MB', description: 'M for B', goal: 'Goal', targetWeek: 1, status: 'planned' }],
      [{ milestoneIndex: 0, title: 'WP-B', description: 'For B', definitionOfDone: ['done'], riskClass: 'B', priority: 'medium', estimatedHours: 8, dependsOn: [], status: 'backlog', tags: [] }],
    )

    const forA = getWorkPackagesByBriefId('brief-A')
    expect(forA).toHaveLength(1)
    expect(forA[0].title).toBe('WP-A')

    const forB = getWorkPackagesByBriefId('brief-B')
    expect(forB).toHaveLength(1)
    expect(forB[0].title).toBe('WP-B')
  })

  it('getMilestonesByBriefId returns empty array when no milestones exist for that brief', () => {
    const result = getMilestonesByBriefId('non-existent-brief')
    expect(result).toEqual([])
  })

  it('getWorkPackagesByBriefId returns empty array when no work packages exist for that brief', () => {
    const result = getWorkPackagesByBriefId('non-existent-brief')
    expect(result).toEqual([])
  })

  it('writeMilestones and readMilestones round-trip correctly', () => {
    const milestones = [
      {
        id: 'ms-rt-1',
        briefId: 'brief-rt',
        title: 'Round-trip milestone',
        description: 'Test persistence',
        goal: 'Data survives',
        targetWeek: 1,
        status: 'planned' as const,
        workPackageIds: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ]

    writeMilestones(milestones)
    const read = readMilestones()

    expect(read).toHaveLength(1)
    expect(read[0].id).toBe('ms-rt-1')
    expect(read[0].title).toBe('Round-trip milestone')
  })

  it('writeWorkPackages and readWorkPackages round-trip correctly', () => {
    const wps = [
      {
        id: 'wp-rt-1',
        milestoneId: 'ms-rt-1',
        briefId: 'brief-rt',
        title: 'Round-trip WP',
        description: 'Persists correctly',
        definitionOfDone: ['Written and read back'],
        riskClass: 'A' as const,
        priority: 'medium' as const,
        estimatedHours: 6,
        dependsOn: [],
        status: 'backlog' as const,
        delegationIds: [],
        tags: ['test'],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ]

    writeWorkPackages(wps)
    const read = readWorkPackages()

    expect(read).toHaveLength(1)
    expect(read[0].id).toBe('wp-rt-1')
    expect(read[0].riskClass).toBe('A')
  })
})
