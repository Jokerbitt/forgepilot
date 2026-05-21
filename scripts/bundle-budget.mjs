#!/usr/bin/env node
/**
 * Bundle-size budget checker.
 *
 * Reads `config/bundle-budget.json` for the limits, walks the Next.js
 * `.next/static/chunks` directory built by `npm run build`, and:
 *
 *  - prints the top N largest chunks as a Markdown table
 *  - fails (exit 1) if any chunk exceeds `maxKbPerChunk`
 *  - fails (exit 1) if the cumulative size exceeds `maxKbTotal`
 *  - honours `exceptions[]` — exact chunk filenames allowed past the cap
 *
 * Usage:
 *   node scripts/bundle-budget.mjs                  # human output
 *   node scripts/bundle-budget.mjs --markdown       # GitHub-summary format
 *   node scripts/bundle-budget.mjs --json           # machine-readable
 *   node scripts/bundle-budget.mjs --config path    # alt config path
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Kept at repo root (not in `config/` which is gitignored runtime state).
const DEFAULT_CONFIG_PATH = join(process.cwd(), 'bundle-budget.config.json')

const DEFAULT_CONFIG = {
  chunksDir: '.next/static/chunks',
  maxKbPerChunk: 500,
  maxKbTotal: 6000,
  topN: 10,
  exceptions: [],
}

// ─── Pure helpers (covered by tests) ─────────────────────────────────────────

export function listChunks(chunksDir) {
  if (!existsSync(chunksDir)) return []
  return readdirSync(chunksDir)
    .filter(f => f.endsWith('.js'))
    .map(f => ({ name: f, size: statSync(join(chunksDir, f)).size }))
    .sort((a, b) => b.size - a.size)
}

export function evaluateBudget(chunks, config) {
  const exceptions = new Set(config.exceptions ?? [])
  const totalBytes = chunks.reduce((sum, c) => sum + c.size, 0)
  const maxPerChunkBytes = config.maxKbPerChunk * 1024
  const maxTotalBytes = config.maxKbTotal * 1024

  const oversized = chunks.filter(c => c.size > maxPerChunkBytes && !exceptions.has(c.name))
  const totalOk = totalBytes <= maxTotalBytes
  const allOk = oversized.length === 0 && totalOk

  return {
    ok: allOk,
    totalBytes,
    totalKb: Math.round(totalBytes / 1024),
    maxKbTotal: config.maxKbTotal,
    maxKbPerChunk: config.maxKbPerChunk,
    totalOk,
    oversized,
    topN: chunks.slice(0, config.topN ?? 10),
  }
}

export function renderMarkdown(report) {
  const lines = []
  lines.push('## Bundle Size Report')
  lines.push('')
  lines.push(`Total: **${report.totalKb} KB** / ${report.maxKbTotal} KB  ${report.totalOk ? '✅' : '❌ OVER BUDGET'}`)
  lines.push(`Per-chunk cap: ${report.maxKbPerChunk} KB`)
  lines.push('')
  lines.push('| Chunk | Size | Status |')
  lines.push('|---|---|---|')
  for (const c of report.topN) {
    const sizeKb = (c.size / 1024).toFixed(1)
    const over = c.size > report.maxKbPerChunk * 1024
    lines.push(`| \`${c.name.slice(0, 60)}\` | ${sizeKb} KB | ${over ? '❌ over' : '✅'} |`)
  }
  if (report.oversized.length > 0) {
    lines.push('')
    lines.push(`### ❌ ${report.oversized.length} chunk(s) exceed ${report.maxKbPerChunk} KB`)
    for (const c of report.oversized) {
      lines.push(`- \`${c.name}\` — ${(c.size / 1024).toFixed(1)} KB`)
    }
  }
  return lines.join('\n')
}

export function loadConfig(path = DEFAULT_CONFIG_PATH) {
  if (!existsSync(path)) return { ...DEFAULT_CONFIG }
  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8'))
    return { ...DEFAULT_CONFIG, ...raw }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

// ─── CLI driver ──────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = { markdown: false, json: false, configPath: DEFAULT_CONFIG_PATH }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--markdown') out.markdown = true
    else if (argv[i] === '--json') out.json = true
    else if (argv[i] === '--config') {
      out.configPath = argv[i + 1] ?? DEFAULT_CONFIG_PATH
      i++
    }
  }
  return out
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const config = loadConfig(args.configPath)
  const chunks = listChunks(config.chunksDir)

  if (chunks.length === 0) {
    console.error(`No chunks found in ${config.chunksDir} — did you run \`npm run build\` first?`)
    process.exit(2)
  }

  const report = evaluateBudget(chunks, config)

  if (args.json) {
    console.log(JSON.stringify(report, null, 2))
  } else if (args.markdown) {
    console.log(renderMarkdown(report))
  } else {
    console.log(renderMarkdown(report))
  }

  if (!report.ok) {
    console.error('\nBundle budget exceeded.')
    process.exit(1)
  }
}

const isDirect = import.meta.url === `file://${process.argv[1]}`
if (isDirect) main()
