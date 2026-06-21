/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { sanitizeRepoName, suggestRepoPath, createLocalRepo, ensureTargetRepo } from './create-repo'

describe('sanitizeRepoName', () => {
  it('slugifies free text', () => {
    expect(sanitizeRepoName('My Cool SaaS!')).toBe('my-cool-saas')
    expect(sanitizeRepoName('  Über App  ')).toBe('ber-app')
    expect(sanitizeRepoName('')).toBe('app')
  })
})

describe('suggestRepoPath', () => {
  it('joins base + slug when free', () => {
    expect(suggestRepoPath('Notes App', '/base', () => false)).toBe('/base/notes-app')
  })
  it('adds a numeric suffix on collision', () => {
    const taken = new Set(['/base/notes-app', '/base/notes-app-2'])
    expect(suggestRepoPath('Notes App', '/base', p => taken.has(p))).toBe('/base/notes-app-3')
  })
})

describe('createLocalRepo / ensureTargetRepo', () => {
  let dir: string
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-create-')) })
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }) })

  it('creates a git repo with README + .gitignore + initial commit', () => {
    const target = path.join(dir, 'my-app')
    const res = createLocalRepo({ targetPath: target, appName: 'My App' })
    expect(res.created).toBe(true)
    expect(fs.existsSync(path.join(target, '.git'))).toBe(true)
    expect(fs.readFileSync(path.join(target, 'README.md'), 'utf-8')).toContain('My App')
    expect(fs.existsSync(path.join(target, '.gitignore'))).toBe(true)
    // Has at least one commit
    expect(fs.existsSync(path.join(target, '.git', 'refs'))).toBe(true)
  })

  it('reuses an existing repo idempotently', () => {
    const target = path.join(dir, 'app')
    createLocalRepo({ targetPath: target, appName: 'App' })
    const again = createLocalRepo({ targetPath: target, appName: 'App' })
    expect(again.created).toBe(false)
    expect(again.reused).toBe(true)
  })

  it('ensureTargetRepo picks a path under baseDir and creates it', () => {
    const res = ensureTargetRepo({ appName: 'Fresh One', baseDir: dir })
    expect(res.created).toBe(true)
    expect(res.path).toBe(path.join(dir, 'fresh-one'))
    expect(fs.existsSync(path.join(res.path, '.git'))).toBe(true)
  })
})
