import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { planCreateApp, createApp, summarizeCreateApp, autoScaffoldWorkspace } from './create-app'
import { getBundle } from './bundles'
import { scopedScaffoldBlockIds } from './catalog'

describe('planCreateApp', () => {
  it('plans every file of every block in a bundle', () => {
    const plan = planCreateApp({ bundleId: 'local-first' })
    const bundle = getBundle('local-first')!
    const expectedFiles = bundle.blockIds.flatMap(id => plan.blocks.find(b => b.id === id)?.files.length ?? 0)
    expect(plan.files.length).toBe(expectedFiles.reduce((a, b) => a + b, 0))
    expect(plan.blocks.map(b => b.id)).toEqual(bundle.blockIds)
  })

  it('merges and sorts dependencies without duplicates', () => {
    const plan = planCreateApp({ bundleId: 'saas-starter' })
    const sorted = [...plan.dependencies].sort()
    expect(plan.dependencies).toEqual(sorted)
    expect(new Set(plan.dependencies).size).toBe(plan.dependencies.length)
  })

  it('prefixes setup steps with the block name', () => {
    const plan = planCreateApp({ blockIds: ['connector-email'] })
    expect(plan.setupSteps.every(s => s.startsWith('['))).toBe(true)
  })

  it('throws on unknown bundle / block', () => {
    expect(() => planCreateApp({ bundleId: 'nope' })).toThrow(/Unknown bundle/)
    expect(() => planCreateApp({ blockIds: ['nope'] })).toThrow(/Unknown block/)
    expect(() => planCreateApp({})).toThrow(/requires/)
  })
})

describe('createApp', () => {
  let dir: string
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'create-app-')) })
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }) })

  it('copies real template files into the target dir', () => {
    const res = createApp({ bundleId: 'local-first', targetDir: dir })
    expect(res.missingTemplates).toEqual([])
    expect(res.written.length).toBeGreaterThan(0)
    // The files actually exist on disk now
    for (const rel of res.written) {
      expect(fs.existsSync(path.join(dir, rel))).toBe(true)
    }
  })

  it('dryRun plans without writing', () => {
    const res = createApp({ bundleId: 'local-first', targetDir: dir, dryRun: true })
    expect(res.written.length).toBeGreaterThan(0)
    for (const rel of res.written) {
      expect(fs.existsSync(path.join(dir, rel))).toBe(false)
    }
  })

  it('skips existing files unless force', () => {
    createApp({ bundleId: 'local-first', targetDir: dir })
    const second = createApp({ bundleId: 'local-first', targetDir: dir })
    expect(second.skipped.length).toBeGreaterThan(0)
    expect(second.written.length).toBe(0)

    const forced = createApp({ bundleId: 'local-first', targetDir: dir, force: true })
    expect(forced.written.length).toBeGreaterThan(0)
    expect(forced.skipped.length).toBe(0)
  })

  it('copies email connector files for a connector-only request', () => {
    const res = createApp({ blockIds: ['connector-email'], targetDir: dir })
    expect(res.missingTemplates).toEqual([])
    expect(fs.existsSync(path.join(dir, 'src/lib/email/index.ts'))).toBe(true)
  })

  it('summary mentions copied count and deps', () => {
    const res = createApp({ blockIds: ['connector-storage'], targetDir: dir })
    const summary = summarizeCreateApp(res)
    expect(summary).toMatch(/Dateien kopiert/)
    expect(summary).toMatch(/npm i .*aws-sdk/)
  })
})

describe('autoScaffoldWorkspace', () => {
  let dir: string
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-')) })
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }) })

  it('scaffolds a fresh workspace from the resolved blocks + writes SCAFFOLD.md', () => {
    const res = autoScaffoldWorkspace({
      workspacePath: dir,
      goal: 'Build a foundation',
      resolveBlockIds: () => ['testing-vitest', 'ui-app-shell'],
    })
    expect(res.scaffolded).toBe(true)
    expect((res.fileCount ?? 0)).toBeGreaterThan(0)
    expect(fs.existsSync(path.join(dir, 'SCAFFOLD.md'))).toBe(true)
  })

  it('refuses to scaffold when package.json already exists', () => {
    fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"x"}')
    const res = autoScaffoldWorkspace({
      workspacePath: dir,
      goal: 'Build a SaaS platform',
      resolveBlockIds: () => ['ui-app-shell'],
    })
    expect(res.scaffolded).toBe(false)
    expect(res.reason).toMatch(/nicht leer/)
  })

  it('skips when the resolver returns no blocks', () => {
    const res = autoScaffoldWorkspace({
      workspacePath: dir,
      goal: 'xyzzy plugh frobnicate',
      resolveBlockIds: () => [],
    })
    expect(res.scaffolded).toBe(false)
  })

  it('uses scopedScaffoldBlockIds to copy only what the goal needs', () => {
    // A pure-foundation goal must NOT drag in billing/auth blocks.
    const ids = scopedScaffoldBlockIds('Scaffold the Next.js foundation and app shell, landing page')
    expect(ids).toContain('ui-app-shell')
    expect(ids).toContain('testing-vitest')
    expect(ids).not.toContain('billing-stripe')
    expect(ids).not.toContain('auth-credentials')
  })
})
