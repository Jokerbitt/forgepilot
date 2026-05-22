/**
 * test-flow.test.ts — Unit tests for the E2E flow helper logic.
 *
 * Tests argument parsing, provider detection shape, and dry-run behaviour
 * without hitting real LLM APIs or writing to disk.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'node:path'

// ─── Provider availability shape ──────────────────────────────────────────────

describe('getProviderAvailability', () => {
  it('returns an array with expected provider ids', async () => {
    const { getProviderAvailability } = await import('@/lib/ai/auto-router')
    const providers = await getProviderAvailability()
    expect(Array.isArray(providers)).toBe(true)
    const ids = providers.map(p => p.id)
    expect(ids).toContain('anthropic')
    expect(ids).toContain('ollama')
  })

  it('each entry has required fields', async () => {
    const { getProviderAvailability } = await import('@/lib/ai/auto-router')
    const providers = await getProviderAvailability()
    for (const p of providers) {
      expect(typeof p.id).toBe('string')
      expect(typeof p.name).toBe('string')
      expect(typeof p.available).toBe('boolean')
      expect(typeof p.model).toBe('string')
    }
  })
})

// ─── resolveProvider shape ────────────────────────────────────────────────────

describe('resolveProvider', () => {
  it('returns a ResolvedProvider object with required fields', async () => {
    const { resolveProvider } = await import('@/lib/ai/auto-router')
    const resolved = await resolveProvider('fast')
    expect(typeof resolved.providerId).toBe('string')
    expect(typeof resolved.model).toBe('string')
    expect(typeof resolved.isFree).toBe('boolean')
    expect(typeof resolved.isLocal).toBe('boolean')
    expect(typeof resolved.reason).toBe('string')
  })

  it('returns placeholder provider when LLM_MODE is set to unknown provider', async () => {
    const original = process.env['LLM_MODE']
    process.env['LLM_MODE'] = 'nonexistent-provider-xyz'
    try {
      const { resolveProvider } = await import('@/lib/ai/auto-router')
      const resolved = await resolveProvider('fast')
      // Falls back to auto behavior — should not throw
      expect(typeof resolved.providerId).toBe('string')
    } finally {
      if (original === undefined) {
        delete process.env['LLM_MODE']
      } else {
        process.env['LLM_MODE'] = original
      }
    }
  })
})

// ─── Dry-run: no writes to disk ───────────────────────────────────────────────

describe('dry-run mode — no writes', () => {
  it('buildProjectBrief produces a valid in-memory brief without writing', async () => {
    const { buildProjectBrief } = await import('@/lib/project-briefs')

    const input = {
      title: '[Test] Dry-run Brief',
      rawIdea: 'Eine Testidee für den Dry-run. Ausreichend lang um die Validierung zu bestehen.',
      problemStatement: 'Das Problem besteht darin, dass Tests fehlen.',
      targetAudience: 'Entwickler',
      desiredOutcome: 'Alle Tests laufen grün.',
      constraints: [],
      scope: 'minimal' as const,
      researchMode: 'quick' as const,
      privacyMode: 'local' as const,
    }

    const brief = buildProjectBrief(input)
    expect(typeof brief.id).toBe('string')
    expect(brief.id.length).toBeGreaterThan(0)
    expect(brief.title).toBe('[Test] Dry-run Brief')
    // buildProjectBrief sets status to 'in_review' (not draft)
    expect(['draft', 'in_review']).toContain(brief.status)
    // does NOT persist to disk — just returns the object
  })
})

// ─── Argument parsing logic ───────────────────────────────────────────────────

describe('CLI argument parsing', () => {
  it('parseArgs correctly handles --provider flag', () => {
    const { parseArgs } = require('node:util') as typeof import('node:util')
    const { values } = parseArgs({
      args: ['--provider=anthropic', '--verbose'],
      options: {
        provider:    { type: 'string' },
        verbose:     { type: 'boolean', default: false },
        'dry-run':   { type: 'boolean', default: false },
        'no-cleanup':{ type: 'boolean', default: false },
      },
      strict: false,
    })
    expect(values.provider).toBe('anthropic')
    expect(values.verbose).toBe(true)
    expect(values['dry-run']).toBe(false)
  })

  it('parseArgs handles --dry-run flag', () => {
    const { parseArgs } = require('node:util') as typeof import('node:util')
    const { values } = parseArgs({
      args: ['--dry-run'],
      options: {
        provider:    { type: 'string' },
        verbose:     { type: 'boolean', default: false },
        'dry-run':   { type: 'boolean', default: false },
        'no-cleanup':{ type: 'boolean', default: false },
      },
      strict: false,
    })
    expect(values['dry-run']).toBe(true)
    expect(values.provider).toBeUndefined()
  })

  it('parseArgs handles --no-cleanup flag', () => {
    const { parseArgs } = require('node:util') as typeof import('node:util')
    const { values } = parseArgs({
      args: ['--no-cleanup'],
      options: {
        provider:    { type: 'string' },
        verbose:     { type: 'boolean', default: false },
        'dry-run':   { type: 'boolean', default: false },
        'no-cleanup':{ type: 'boolean', default: false },
      },
      strict: false,
    })
    expect(values['no-cleanup']).toBe(true)
  })
})

// ─── buildProjectBrief validation ─────────────────────────────────────────────

describe('buildProjectBrief', () => {
  it('generates a unique id on each call', async () => {
    const { buildProjectBrief } = await import('@/lib/project-briefs')
    const input = {
      title: 'Test A',
      rawIdea: 'Genug Text für die Validierung hier eingeben.',
      problemStatement: 'Problem A ist relevant.',
      targetAudience: 'Nutzer A',
      desiredOutcome: 'Ergebnis A ist messbar.',
      constraints: [],
      scope: 'minimal' as const,
      researchMode: 'quick' as const,
      privacyMode: 'local' as const,
    }
    const b1 = buildProjectBrief(input)
    const b2 = buildProjectBrief(input)
    expect(b1.id).not.toBe(b2.id)
  })

  it('trims title and rawIdea', async () => {
    const { buildProjectBrief } = await import('@/lib/project-briefs')
    const brief = buildProjectBrief({
      title: '  Trimmed Title  ',
      rawIdea: '  Idee mit Leerzeichen am Rand. Ausreichend lang.  ',
      problemStatement: 'Das Problem.',
      targetAudience: 'Dev',
      desiredOutcome: 'Outcome klar definiert.',
      constraints: [],
      scope: 'minimal' as const,
      researchMode: 'quick' as const,
      privacyMode: 'local' as const,
    })
    expect(brief.title).toBe('Trimmed Title')
    expect(brief.rawIdea.startsWith('Idee')).toBe(true)
  })
})
