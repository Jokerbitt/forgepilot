import { describe, it, expect } from 'vitest'
import { evaluateBudget, renderMarkdown, loadConfig } from './bundle-budget.mjs'

const cfg = {
  chunksDir: '.next/static/chunks',
  maxKbPerChunk: 500,
  maxKbTotal: 6000,
  topN: 5,
  exceptions: [],
}

describe('evaluateBudget', () => {
  it('passes when every chunk and the total are within limits', () => {
    const chunks = [
      { name: 'a.js', size: 100 * 1024 },
      { name: 'b.js', size: 200 * 1024 },
      { name: 'c.js', size: 300 * 1024 },
    ]
    const r = evaluateBudget(chunks, cfg)
    expect(r.ok).toBe(true)
    expect(r.oversized).toEqual([])
    expect(r.totalKb).toBe(600)
    expect(r.totalOk).toBe(true)
  })

  it('flags chunks that exceed the per-chunk cap', () => {
    const chunks = [
      { name: 'big.js', size: 600 * 1024 },
      { name: 'small.js', size: 50 * 1024 },
    ]
    const r = evaluateBudget(chunks, cfg)
    expect(r.ok).toBe(false)
    expect(r.oversized.map(c => c.name)).toEqual(['big.js'])
  })

  it('honours the exceptions allowlist', () => {
    const chunks = [{ name: 'huge-but-allowed.js', size: 700 * 1024 }]
    const r = evaluateBudget(chunks, { ...cfg, exceptions: ['huge-but-allowed.js'] })
    expect(r.ok).toBe(true)
    expect(r.oversized).toEqual([])
  })

  it('flags the total when the cumulative size is too high', () => {
    const chunks = Array.from({ length: 20 }, (_, i) => ({
      name: `c${i}.js`,
      size: 400 * 1024, // 8 MB total
    }))
    const r = evaluateBudget(chunks, cfg)
    expect(r.ok).toBe(false)
    expect(r.totalOk).toBe(false)
    expect(r.oversized).toEqual([]) // each chunk is under per-chunk cap
  })

  it('returns the top-N largest chunks for reporting', () => {
    const chunks = Array.from({ length: 10 }, (_, i) => ({
      name: `c${i}.js`,
      size: (10 - i) * 1024,
    }))
    const r = evaluateBudget(chunks, { ...cfg, topN: 3 })
    expect(r.topN.map(c => c.name)).toEqual(['c0.js', 'c1.js', 'c2.js'])
  })

  it('treats an empty chunk list as passing (total = 0)', () => {
    const r = evaluateBudget([], cfg)
    expect(r.ok).toBe(true)
    expect(r.totalKb).toBe(0)
  })
})

describe('renderMarkdown', () => {
  it('renders a passing report with checkmark', () => {
    const r = evaluateBudget(
      [{ name: 'main.js', size: 100 * 1024 }],
      cfg,
    )
    const md = renderMarkdown(r)
    expect(md).toContain('## Bundle Size Report')
    expect(md).toContain('Total: **100 KB**')
    expect(md).toContain('✅')
    expect(md).not.toContain('OVER BUDGET')
  })

  it('marks per-chunk overruns in the report', () => {
    const r = evaluateBudget(
      [{ name: 'fat.js', size: 600 * 1024 }, { name: 'ok.js', size: 200 * 1024 }],
      cfg,
    )
    const md = renderMarkdown(r)
    expect(md).toContain('❌ over') // per-chunk marker in the table row
    expect(md).toContain('fat.js')
    expect(md).toContain('exceed 500 KB')
  })

  it('marks total overrun with OVER BUDGET banner', () => {
    const chunks = Array.from({ length: 20 }, (_, i) => ({
      name: `c${i}.js`,
      size: 400 * 1024, // 8 MB total — over the 6 MB total cap, no single chunk over the per-chunk cap
    }))
    const r = evaluateBudget(chunks, cfg)
    const md = renderMarkdown(r)
    expect(md).toContain('OVER BUDGET')
  })
})

describe('loadConfig', () => {
  it('falls back to defaults when config file does not exist', () => {
    const c = loadConfig('/nonexistent/path/whatever.json')
    expect(c.maxKbPerChunk).toBe(500)
    expect(c.maxKbTotal).toBe(6000)
  })
})
