import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { selectRelevantBlocks, buildBuildingBlocksCatalog, buildingBlocksRoot } from './catalog'
import { BUILDING_BLOCKS, getBlock, getBlocksByCategory } from './registry'
import { BUNDLES, getBundle, bundleBlocks, matchBundle } from './bundles'

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

  it('catalog stays bounded even for a full SaaS bundle', () => {
    const out = buildBuildingBlocksCatalog('Build a multi-user SaaS platform with subscriptions')
    // a 10-block bundle is the largest case — still well under a context-blowing size
    expect(out.length).toBeLessThan(12000)
  })

  it('a focused local-first goal yields a small catalog', () => {
    const out = buildBuildingBlocksCatalog('Build a simple local todo tracker')
    expect(out.length).toBeLessThan(4000)
  })

  it('mentions the building-blocks directory path', () => {
    const out = buildBuildingBlocksCatalog('Add auth')
    expect(out).toContain('building-blocks')
  })
})

describe('bundles', () => {
  it('every bundle references only existing block ids', () => {
    for (const bundle of BUNDLES) {
      for (const id of bundle.blockIds) {
        expect(getBlock(id), `${bundle.id} → ${id}`).toBeDefined()
      }
    }
  })

  it('matchBundle routes a SaaS goal to the saas-starter bundle', () => {
    const b = matchBundle('Build a multi-user SaaS with subscription billing')
    expect(b?.id).toBe('saas-starter')
  })

  it('matchBundle routes an AI goal to the ai-app bundle', () => {
    const b = matchBundle('Build an AI chatbot assistant with an LLM')
    expect(b?.id).toBe('ai-app')
  })

  it('matchBundle routes a full AI SaaS goal to the ai-saas bundle', () => {
    const b = matchBundle('Build an AI content generation SaaS with usage billing and generation history')
    expect(b?.id).toBe('ai-saas')
    expect(b?.blockIds).toContain('auth-credentials')
    expect(b?.blockIds).toContain('billing-stripe')
    expect(b?.blockIds).toContain('ai-routing')
  })

  it('matchBundle routes a todo goal to local-first', () => {
    const b = matchBundle('A simple offline todo tracker with localStorage')
    expect(b?.id).toBe('local-first')
  })

  it('bundleBlocks resolves to real BuildingBlock objects in order', () => {
    const bundle = getBundle('ai-app')!
    const blocks = bundleBlocks(bundle)
    expect(blocks.length).toBe(bundle.blockIds.length)
    expect(blocks[0].id).toBe(bundle.blockIds[0])
  })

  it('returns null for a goal that matches no bundle', () => {
    expect(matchBundle('xyzzy plugh frobnicate')).toBeNull()
  })
})

describe('catalog with bundles', () => {
  it('surfaces the recommended bundle for a SaaS goal', () => {
    const out = buildBuildingBlocksCatalog('Build a SaaS platform with billing and auth')
    expect(out).toContain('Recommended bundle')
    expect(out).toContain('SaaS Starter')
  })

  it('includes the new AI routing block for an AI goal', () => {
    const out = buildBuildingBlocksCatalog('Build an LLM chatbot with cost guardrails')
    expect(out).toContain('AI Auto-Router')
  })

  it('appends a connector ONLY when the goal references it', () => {
    const withEmail = buildBuildingBlocksCatalog('Build a SaaS that emails users a verification link')
    expect(withEmail).toContain('Email (Resend / SMTP)')

    const withoutEmail = buildBuildingBlocksCatalog('Build a multi-user SaaS platform with subscriptions')
    expect(withoutEmail).not.toContain('Email (Resend / SMTP)')
  })

  it('surfaces storage + oauth connectors on top of a bundle when asked', () => {
    const out = buildBuildingBlocksCatalog('SaaS with avatar file uploads and login with Google')
    expect(out).toContain('File Storage')
    expect(out).toContain('OAuth Login')
  })

  it('surfaces tier-2 connectors only when the goal references them', () => {
    const out = buildBuildingBlocksCatalog('SaaS with realtime board updates, Slack notifications, PostHog analytics and a cron digest job')
    expect(out).toContain('Realtime')
    expect(out).toContain('Notifications')
    expect(out).toContain('Product Analytics')
    expect(out).toContain('Scheduled Jobs')

    const plain = buildBuildingBlocksCatalog('Build a multi-user SaaS platform with subscriptions')
    expect(plain).not.toContain('Product Analytics')
    expect(plain).not.toContain('Scheduled Jobs')
  })

  it('surfaces tier-3 connectors (search, sms, pdf) when referenced', () => {
    const out = buildBuildingBlocksCatalog('SaaS with full-text search, SMS 2FA codes and PDF invoice export')
    expect(out).toContain('Full-Text Search')
    expect(out).toContain('SMS')
    expect(out).toContain('PDF Generation')

    const plain = buildBuildingBlocksCatalog('Build a simple local todo tracker')
    expect(plain).not.toContain('PDF Generation')
    expect(plain).not.toContain('Full-Text Search')
  })
})
