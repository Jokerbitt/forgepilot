import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── fs mock ─────────────────────────────────────────────────────────────────

const store = vi.hoisted(() => ({} as Record<string, string>))

vi.mock('fs', () => {
  const fsMock = {
    existsSync:    (p: string) => p in store,
    readFileSync:  (p: string) => {
      if (p in store) return store[p]
      throw Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' })
    },
    writeFileSync: (p: string, data: string) => { store[p] = data },
    renameSync:    (tmp: string, dest: string) => {
      if (tmp in store) { store[dest] = store[tmp]; delete store[tmp] }
    },
    mkdirSync: vi.fn(),
  }
  return { default: fsMock, ...fsMock }
})

// ─── Schema type tests ────────────────────────────────────────────────────────

describe('M180 schema types', () => {
  it('DbProjectBrief inferSelect type has expected fields', async () => {
    const { projectBriefs } = await import('@/db/schema')
    // Verify the table object has the expected column keys
    expect(projectBriefs).toBeDefined()
    expect(Object.keys(projectBriefs)).toContain('id')
    expect(Object.keys(projectBriefs)).toContain('title')
    expect(Object.keys(projectBriefs)).toContain('status')
    expect(Object.keys(projectBriefs)).toContain('content')
    expect(Object.keys(projectBriefs)).toContain('version')
    expect(Object.keys(projectBriefs)).toContain('createdAt')
    expect(Object.keys(projectBriefs)).toContain('updatedAt')
  })

  it('DbKnowledgeCard inferSelect type has expected fields', async () => {
    const { knowledgeCards } = await import('@/db/schema')
    expect(knowledgeCards).toBeDefined()
    expect(Object.keys(knowledgeCards)).toContain('id')
    expect(Object.keys(knowledgeCards)).toContain('type')
    expect(Object.keys(knowledgeCards)).toContain('title')
    expect(Object.keys(knowledgeCards)).toContain('body')
    expect(Object.keys(knowledgeCards)).toContain('delegationId')
    expect(Object.keys(knowledgeCards)).toContain('tags')
    expect(Object.keys(knowledgeCards)).toContain('confidence')
  })
})

// ─── ProjectBriefRepository factory tests ────────────────────────────────────

describe('createProjectBriefRepository', () => {
  const origEnv = process.env.DATABASE_URL

  afterEach(() => {
    if (origEnv === undefined) {
      delete process.env.DATABASE_URL
    } else {
      process.env.DATABASE_URL = origEnv
    }
    vi.resetModules()
  })

  it('returns JSON implementation when DATABASE_URL is not set', async () => {
    delete process.env.DATABASE_URL
    const { createProjectBriefRepository } = await import('./projectBriefRepository')
    const repo = createProjectBriefRepository()
    // JSON impl: create should work without a DB connection
    const brief = await repo.create({
      title: 'Test Brief',
      status: 'draft',
      rawIdea: 'An idea',
      problemStatement: 'A problem',
      targetAudience: 'Developers',
      desiredOutcome: 'Better DX',
      constraints: [],
      scope: 'minimal',
      researchMode: 'quick',
      privacyMode: 'local',
      requirements: [],
      useCases: [],
      nonGoals: [],
      risks: [],
      researchRunIds: [],
      researchBriefDraft: {
        title: 'Draft',
        mode: 'quick',
        privacyMode: 'local',
        preferredExecutor: 'agent',
        researchQuestions: [],
        searchTerms: [],
        preferredSourceTypes: [],
        excludeCriteria: [],
      },
    })
    expect(brief.id).toBeDefined()
    expect(brief.title).toBe('Test Brief')
  })

  it('finds created brief by id (JSON impl)', async () => {
    delete process.env.DATABASE_URL
    const { createProjectBriefRepository } = await import('./projectBriefRepository')
    const repo = createProjectBriefRepository()
    const created = await repo.create({
      title: 'Findable Brief',
      status: 'draft',
      rawIdea: 'x',
      problemStatement: 'y',
      targetAudience: 'z',
      desiredOutcome: 'w',
      constraints: [],
      scope: 'minimal',
      researchMode: 'quick',
      privacyMode: 'local',
      requirements: [],
      useCases: [],
      nonGoals: [],
      risks: [],
      researchRunIds: [],
      researchBriefDraft: {
        title: 'R',
        mode: 'quick',
        privacyMode: 'local',
        preferredExecutor: 'agent',
        researchQuestions: [],
        searchTerms: [],
        preferredSourceTypes: [],
        excludeCriteria: [],
      },
    })
    const found = await repo.findById(created.id)
    expect(found?.title).toBe('Findable Brief')
  })
})

// ─── KnowledgeCardRepository factory tests ───────────────────────────────────

describe('createKnowledgeCardRepository', () => {
  const origEnv = process.env.DATABASE_URL

  afterEach(() => {
    if (origEnv === undefined) {
      delete process.env.DATABASE_URL
    } else {
      process.env.DATABASE_URL = origEnv
    }
    vi.resetModules()
  })

  it('returns JSON implementation when DATABASE_URL is not set', async () => {
    delete process.env.DATABASE_URL
    const { createKnowledgeCardRepository } = await import('./knowledgeCardRepository')
    const repo = createKnowledgeCardRepository()
    expect(repo).toBeDefined()
    // JSON impl: listAll should not throw
    const cards = await repo.listAll()
    expect(Array.isArray(cards)).toBe(true)
  })

  it('upserts a card and retrieves it (JSON impl)', async () => {
    delete process.env.DATABASE_URL
    const { createKnowledgeCardRepository } = await import('./knowledgeCardRepository')
    const repo = createKnowledgeCardRepository()
    const card = await repo.upsert({
      id: 'test-card-001',
      type: 'learning',
      title: 'A learning card',
      body: 'Body text',
      sourceIds: ['delegation-001'],
      tags: ['auto-extracted'],
      privacyClass: 'internal',
      confidence: 'high',
    })
    expect(card.id).toBe('test-card-001')
    expect(card.title).toBe('A learning card')

    const found = await repo.findById('test-card-001')
    expect(found?.title).toBe('A learning card')
  })

  it('listByDelegation returns matching cards (JSON impl)', async () => {
    delete process.env.DATABASE_URL
    const { createKnowledgeCardRepository } = await import('./knowledgeCardRepository')
    const repo = createKnowledgeCardRepository()
    await repo.upsert({
      type: 'pattern',
      title: 'Pattern card',
      body: 'Body',
      sourceIds: ['delegation-xyz'],
      tags: ['delegation:delegation-xyz'],
      privacyClass: 'internal',
      confidence: 'medium',
    })
    const cards = await repo.listByDelegation('delegation-xyz')
    expect(cards.length).toBeGreaterThan(0)
    expect(cards[0].title).toBe('Pattern card')
  })
})
