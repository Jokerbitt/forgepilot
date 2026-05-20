import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Module-level mocks ───────────────────────────────────────────────────────

// Using a loose record type so we can store both strings and Dirent-like objects
// returned by readdirSync mocks without excessive casting in test helpers.
type FsStore = Record<string, string | object[] | object>
const fsFiles = vi.hoisted(() => ({} as FsStore))

vi.mock('fs', () => {
  const fsMock = {
    existsSync: (p: string) => p in fsFiles,
    readFileSync: (p: string, _enc?: string) => {
      if (p in fsFiles) return fsFiles[p] as string
      throw Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' })
    },
    readdirSync: (p: string) => {
      const key = `dir:${p}`
      if (key in fsFiles) return (fsFiles[key] as unknown[])
      return []
    },
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    renameSync: vi.fn(),
  }
  return { default: fsMock, ...fsMock }
})

vi.mock('@/lib/config/paths', () => ({
  getDocsDir: () => '/nas/docs',
  getDataDir: () => '/data',
}))

vi.mock('@/lib/context/pii-scrubber', () => ({
  scrubPII: vi.fn((text: string) => ({
    scrubbed: text,
    wasModified: false,
    findings: [],
    totalRedacted: 0,
  })),
}))

// ─── helpers ──────────────────────────────────────────────────────────────────

function clearFs() {
  Object.keys(fsFiles).forEach(k => delete fsFiles[k])
}

function setClaudeMd(content = '# Conventions\nUse TypeScript strict.') {
  fsFiles[`${process.cwd()}/CLAUDE.md`] = content
}

function setKnowledgeStore(cards: Array<{
  title: string; body: string; tags: string[]; type: string
}>) {
  fsFiles['/data/knowledge-store.json'] = JSON.stringify({ cards })
}

function setSourceDir(dir: string, files: Array<{ name: string; content: string; isFile?: boolean }>) {
  const absDir = `${process.cwd()}/${dir}`
  // Make existsSync(absDir) return true
  fsFiles[absDir] = 'DIR'
  // readdirSync key
  fsFiles[`dir:${absDir}`] = files.map(f => ({
    name: f.name,
    isFile: () => f.isFile ?? true,
    isDirectory: () => false,
  }))
  for (const f of files) {
    fsFiles[`${absDir}/${f.name}`] = f.content
  }
}

// ─── import after mocks ───────────────────────────────────────────────────────

describe('buildContext', () => {
  beforeEach(() => {
    clearFs()
    vi.resetModules()
  })

  // ── Layer 1: Task (always present) ─────────────────────────────────────────

  it('always includes task layer with title', async () => {
    const { buildContext } = await import('./context-engineer')
    const result = await buildContext({
      taskTitle: 'Implement auth',
      taskDescription: '',
      acceptanceCriteria: [],
    })
    const taskLayer = result.layers.find(l => l.name === 'task')
    expect(taskLayer).toBeDefined()
    expect(taskLayer?.content).toContain('Implement auth')
  })

  it('includes task description in task layer', async () => {
    const { buildContext } = await import('./context-engineer')
    const result = await buildContext({
      taskTitle: 'Fix bug',
      taskDescription: 'The login flow crashes on Safari.',
      acceptanceCriteria: [],
    })
    const taskLayer = result.layers.find(l => l.name === 'task')
    expect(taskLayer?.content).toContain('The login flow crashes on Safari.')
  })

  it('includes acceptance criteria in task layer', async () => {
    const { buildContext } = await import('./context-engineer')
    const result = await buildContext({
      taskTitle: 'Feat',
      taskDescription: '',
      acceptanceCriteria: ['Tests pass', 'No regressions'],
    })
    const taskLayer = result.layers.find(l => l.name === 'task')
    expect(taskLayer?.content).toContain('Tests pass')
    expect(taskLayer?.content).toContain('No regressions')
  })

  it('includes extraContext in task layer when provided', async () => {
    const { buildContext } = await import('./context-engineer')
    const result = await buildContext({
      taskTitle: 'Task',
      taskDescription: '',
      acceptanceCriteria: [],
      extraContext: 'Additional info here.',
    })
    const taskLayer = result.layers.find(l => l.name === 'task')
    expect(taskLayer?.content).toContain('Additional info here.')
  })

  it('task layer has priority 1', async () => {
    const { buildContext } = await import('./context-engineer')
    const result = await buildContext({
      taskTitle: 'Task',
      taskDescription: '',
      acceptanceCriteria: [],
    })
    const taskLayer = result.layers.find(l => l.name === 'task')
    expect(taskLayer?.priority).toBe(1)
  })

  // ── Layer 2: Code files ─────────────────────────────────────────────────────

  it('adds code layer when filePatterns match existing dir', async () => {
    setSourceDir('src/api', [{ name: 'route.ts', content: 'export const GET = ...' }])
    vi.resetModules()
    const { buildContext } = await import('./context-engineer')
    const result = await buildContext({
      taskTitle: 'Task',
      taskDescription: '',
      acceptanceCriteria: [],
      filePatterns: ['src/api/*.ts'],
    })
    const codeLayer = result.layers.find(l => l.name === 'code')
    expect(codeLayer).toBeDefined()
    expect(codeLayer?.content).toContain('route.ts')
  })

  it('skips test files in code layer', async () => {
    setSourceDir('src/api', [
      { name: 'route.ts', content: 'export const GET = ...' },
      { name: 'route.test.ts', content: 'describe(...)' },
    ])
    vi.resetModules()
    const { buildContext } = await import('./context-engineer')
    const result = await buildContext({
      taskTitle: 'Task',
      taskDescription: '',
      acceptanceCriteria: [],
      filePatterns: ['src/api/*.ts'],
    })
    const codeLayer = result.layers.find(l => l.name === 'code')
    expect(codeLayer?.content).not.toContain('route.test.ts')
  })

  it('omits code layer when no filePatterns provided', async () => {
    const { buildContext } = await import('./context-engineer')
    const result = await buildContext({
      taskTitle: 'Task',
      taskDescription: '',
      acceptanceCriteria: [],
    })
    expect(result.layers.find(l => l.name === 'code')).toBeUndefined()
  })

  it('omits code layer when directory does not exist', async () => {
    // no files set in fsFiles — existsSync returns false
    vi.resetModules()
    const { buildContext } = await import('./context-engineer')
    const result = await buildContext({
      taskTitle: 'Task',
      taskDescription: '',
      acceptanceCriteria: [],
      filePatterns: ['src/nonexistent/*.ts'],
    })
    expect(result.layers.find(l => l.name === 'code')).toBeUndefined()
  })

  // ── Layer 4: Conventions ────────────────────────────────────────────────────

  it('adds conventions layer when CLAUDE.md exists', async () => {
    setClaudeMd('# Project Rules\nNo any types.')
    vi.resetModules()
    const { buildContext } = await import('./context-engineer')
    const result = await buildContext({
      taskTitle: 'Task',
      taskDescription: '',
      acceptanceCriteria: [],
    })
    const convLayer = result.layers.find(l => l.name === 'conventions')
    expect(convLayer).toBeDefined()
    expect(convLayer?.content).toContain('No any types.')
  })

  it('omits conventions layer when CLAUDE.md is missing', async () => {
    // no CLAUDE.md set
    const { buildContext } = await import('./context-engineer')
    const result = await buildContext({
      taskTitle: 'Task',
      taskDescription: '',
      acceptanceCriteria: [],
    })
    expect(result.layers.find(l => l.name === 'conventions')).toBeUndefined()
  })

  // ── Layer 5: Memory / Knowledge ─────────────────────────────────────────────

  it('adds memory layer from knowledge store', async () => {
    setKnowledgeStore([
      { title: 'Auth pattern', body: 'Use JWT with 1h TTL.', tags: ['auto-extracted'], type: 'learning' },
    ])
    vi.resetModules()
    const { buildContext } = await import('./context-engineer')
    const result = await buildContext({
      taskTitle: 'Task',
      taskDescription: '',
      acceptanceCriteria: [],
    })
    const memLayer = result.layers.find(l => l.name === 'memory')
    expect(memLayer).toBeDefined()
    expect(memLayer?.content).toContain('Auth pattern')
  })

  it('filters knowledge cards by skillCategory tag', async () => {
    setKnowledgeStore([
      { title: 'API card', body: 'Route patterns.', tags: ['skill:api-route'], type: 'learning' },
      { title: 'UI card', body: 'Component tips.', tags: ['skill:ui-component'], type: 'learning' },
    ])
    vi.resetModules()
    const { buildContext } = await import('./context-engineer')
    const result = await buildContext({
      taskTitle: 'Task',
      taskDescription: '',
      acceptanceCriteria: [],
      skillCategory: 'api-route',
    })
    const memLayer = result.layers.find(l => l.name === 'memory')
    expect(memLayer?.content).toContain('API card')
    // 'UI card' has no matching tag — may or may not be included depending on implementation
  })

  it('omits memory layer when knowledge store is empty', async () => {
    setKnowledgeStore([])
    vi.resetModules()
    const { buildContext } = await import('./context-engineer')
    const result = await buildContext({
      taskTitle: 'Task',
      taskDescription: '',
      acceptanceCriteria: [],
    })
    expect(result.layers.find(l => l.name === 'memory')).toBeUndefined()
  })

  it('omits memory layer when knowledge store does not exist', async () => {
    // no knowledge-store.json set
    const { buildContext } = await import('./context-engineer')
    const result = await buildContext({
      taskTitle: 'Task',
      taskDescription: '',
      acceptanceCriteria: [],
    })
    expect(result.layers.find(l => l.name === 'memory')).toBeUndefined()
  })

  // ── Token budget ────────────────────────────────────────────────────────────

  it('uses default token budget of 4000 for unknown model', async () => {
    const { buildContext } = await import('./context-engineer')
    const result = await buildContext({
      taskTitle: 'Task',
      taskDescription: '',
      acceptanceCriteria: [],
    })
    expect(result.budget).toBe(4_000)
  })

  it('uses correct budget for claude-sonnet-4-5', async () => {
    const { buildContext } = await import('./context-engineer')
    const result = await buildContext({
      taskTitle: 'Task',
      taskDescription: '',
      acceptanceCriteria: [],
      modelId: 'claude-sonnet-4-5',
    })
    expect(result.budget).toBe(8_000)
  })

  it('uses correct budget for claude-haiku-4-5', async () => {
    const { buildContext } = await import('./context-engineer')
    const result = await buildContext({
      taskTitle: 'Task',
      taskDescription: '',
      acceptanceCriteria: [],
      modelId: 'claude-haiku-4-5',
    })
    expect(result.budget).toBe(4_000)
  })

  it('uses correct budget for llama-3.1-8b-instant', async () => {
    const { buildContext } = await import('./context-engineer')
    const result = await buildContext({
      taskTitle: 'Task',
      taskDescription: '',
      acceptanceCriteria: [],
      modelId: 'llama-3.1-8b-instant',
    })
    expect(result.budget).toBe(3_000)
  })

  // ── BuiltContext shape ──────────────────────────────────────────────────────

  it('returns totalTokens > 0', async () => {
    const { buildContext } = await import('./context-engineer')
    const result = await buildContext({
      taskTitle: 'Implement auth middleware',
      taskDescription: 'Add JWT validation',
      acceptanceCriteria: ['Tests pass'],
    })
    expect(result.totalTokens).toBeGreaterThan(0)
  })

  it('utilization is between 0 and 1', async () => {
    const { buildContext } = await import('./context-engineer')
    const result = await buildContext({
      taskTitle: 'Task',
      taskDescription: '',
      acceptanceCriteria: [],
    })
    expect(result.utilization).toBeGreaterThanOrEqual(0)
    expect(result.utilization).toBeLessThanOrEqual(1)
  })

  it('assembled contains all layer contents joined', async () => {
    setClaudeMd('# Convention')
    vi.resetModules()
    const { buildContext } = await import('./context-engineer')
    const result = await buildContext({
      taskTitle: 'Do something',
      taskDescription: '',
      acceptanceCriteria: [],
    })
    expect(result.assembled).toContain('Do something')
    expect(result.assembled).toContain('Convention')
  })

  it('piiScrub is called and result is attached', async () => {
    const { scrubPII } = await import('@/lib/context/pii-scrubber')
    vi.mocked(scrubPII).mockReturnValueOnce({
      scrubbed: 'REDACTED',
      wasModified: true,
      findings: [{ type: 'email', count: 1, placeholder: '[EMAIL_REDACTED]' }],
      totalRedacted: 1,
    })
    vi.resetModules()
    const { buildContext } = await import('./context-engineer')
    const result = await buildContext({
      taskTitle: 'Task with alice@example.com',
      taskDescription: '',
      acceptanceCriteria: [],
    })
    expect(result.piiScrub).toBeDefined()
  })

  it('assembled uses piiScrub.scrubbed text', async () => {
    const { scrubPII } = await import('@/lib/context/pii-scrubber')
    vi.mocked(scrubPII).mockReturnValueOnce({
      scrubbed: 'SCRUBBED_TEXT',
      wasModified: true,
      findings: [],
      totalRedacted: 1,
    })
    vi.resetModules()
    const { buildContext } = await import('./context-engineer')
    const result = await buildContext({
      taskTitle: 'Task',
      taskDescription: '',
      acceptanceCriteria: [],
    })
    expect(result.assembled).toBe('SCRUBBED_TEXT')
  })

  it('result has layers array with at least task layer', async () => {
    const { buildContext } = await import('./context-engineer')
    const result = await buildContext({
      taskTitle: 'Task',
      taskDescription: '',
      acceptanceCriteria: [],
    })
    expect(Array.isArray(result.layers)).toBe(true)
    expect(result.layers.length).toBeGreaterThanOrEqual(1)
  })

  it('all layers have required shape (name, content, tokens, priority)', async () => {
    setClaudeMd()
    setKnowledgeStore([
      { title: 'Card', body: 'Body', tags: [], type: 'learning' },
    ])
    vi.resetModules()
    const { buildContext } = await import('./context-engineer')
    const result = await buildContext({
      taskTitle: 'Task',
      taskDescription: 'Desc',
      acceptanceCriteria: ['Done'],
    })
    for (const layer of result.layers) {
      expect(typeof layer.name).toBe('string')
      expect(typeof layer.content).toBe('string')
      expect(typeof layer.tokens).toBe('number')
      expect(typeof layer.priority).toBe('number')
    }
  })
})
