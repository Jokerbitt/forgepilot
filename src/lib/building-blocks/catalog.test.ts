import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { selectRelevantBlocks, buildBuildingBlocksCatalog, buildingBlocksRoot } from './catalog'
import { BUILDING_BLOCKS, getBlock, getBlocksByCategory } from './registry'

describe('registry', () => {
  it('has at least one block per declared category', () => {
    const categories = ['auth', 'database', 'ui-layout', 'billing', 'testing', 'api-crud', 'deployment']
    for (const cat of categories) {
      expect(getBlocksByCategory(cat as never).length).toBeGreaterThan(0)
    }
  })

  it('every block has unique id and required fields', () => {
    const ids = new Set<string>()
    for (const b of BUILDING_BLOCKS) {
      expect(ids.has(b.id)).toBe(false)
      ids.add(b.id)
      expect(b.name).toBeTruthy()
      expect(b.whenToUse.length).toBeGreaterThan(10)
      expect(b.files.length).toBeGreaterThan(0)
      expect(b.keywords.length).toBeGreaterThan(0)
    }
  })

  it('every referenced scaffold file actually exists on disk', () => {
    const root = buildingBlocksRoot(process.cwd())
    for (const b of BUILDING_BLOCKS) {
      for (const f of b.files) {
        const abs = path.join(root, b.category, path.basename(f.src))
        expect(fs.existsSync(abs), `${b.id}: missing ${abs}`).toBe(true)
      }
    }
  })

  it('getBlock returns undefined for unknown id', () => {
    expect(getBlock('does-not-exist')).toBeUndefined()
  })
})

describe('selectRelevantBlocks', () => {
  it('matches auth block for an auth-related goal', () => {
    const blocks = selectRelevantBlocks('Add user login and signup with sessions')
    expect(blocks.some(b => b.category === 'auth')).toBe(true)
  })

  it('matches database block for a persistence goal', () => {
    const blocks = selectRelevantBlocks('Store customers in a postgres database with prisma')
    expect(blocks.some(b => b.category === 'database')).toBe(true)
  })

  it('always includes testing even when irrelevant', () => {
    const blocks = selectRelevantBlocks('Build a marketing landing page hero section')
    expect(blocks.some(b => b.category === 'testing')).toBe(true)
  })

  it('matches billing for a payments goal', () => {
    const blocks = selectRelevantBlocks('Add stripe subscription checkout and pricing')
    expect(blocks.some(b => b.category === 'billing')).toBe(true)
  })

  it('caps the number of blocks', () => {
    const blocks = selectRelevantBlocks('auth database ui billing api deployment testing stripe', '', 4)
    // maxBlocks=4 plus guaranteed testing → at most 5
    expect(blocks.length).toBeLessThanOrEqual(5)
  })
})

describe('buildBuildingBlocksCatalog', () => {
  it('renders a catalog with file read/write instructions', () => {
    const out = buildBuildingBlocksCatalog('Add login with email and password')
    expect(out).toContain('Reusable Building Blocks')
    expect(out).toContain('When:')
    expect(out).toMatch(/read `.*auth.*` → write `.*`/)
  })

  it('catalog is token-light — under 4000 chars for a focused goal', () => {
    const out = buildBuildingBlocksCatalog('Add a CRUD API for todos')
    expect(out.length).toBeLessThan(4000)
  })

  it('mentions the building-blocks directory path', () => {
    const out = buildBuildingBlocksCatalog('Add auth')
    expect(out).toContain('building-blocks')
  })
})
