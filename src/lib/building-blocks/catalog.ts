/**
 * catalog.ts — selects relevant building blocks for a task and renders the
 * lightweight catalog that gets injected into the agent prompt.
 *
 * Token-efficient: we inject metadata only (name, when-to-use, file paths).
 * The agent reads the actual scaffold files on demand via the Read tool.
 */

import path from 'path'
import { BUILDING_BLOCKS } from './registry'
import { matchBundle, bundleBlocks, keywordHit } from './bundles'
import type { BuildingBlock } from './types'

/** Absolute path to the building-blocks/ directory (repo root). */
export function buildingBlocksRoot(repoRoot: string = process.cwd()): string {
  return path.join(repoRoot, 'building-blocks')
}

/** Score a block's relevance to a task goal by keyword overlap. */
function scoreBlock(block: BuildingBlock, goalLower: string): number {
  let score = 0
  for (const kw of block.keywords) {
    if (keywordHit(goalLower, kw)) score += 2
  }
  // Light boost for the block name words
  for (const word of block.name.toLowerCase().split(/\W+/)) {
    if (word.length >= 4 && keywordHit(goalLower, word)) score += 1
  }
  return score
}

/**
 * Select blocks relevant to a goal. Testing is always included (every build
 * needs tests). Returns blocks sorted by relevance, capped at maxBlocks.
 */
export function selectRelevantBlocks(
  goal: string,
  context = '',
  maxBlocks = 6,
): BuildingBlock[] {
  const haystack = `${goal} ${context}`.toLowerCase()

  const scored = BUILDING_BLOCKS
    .map(block => ({ block, score: scoreBlock(block, haystack) }))
    .filter(s => s.score > 0 || s.block.category === 'testing')
    .sort((a, b) => b.score - a.score)

  // Always keep testing in the set even if it scored 0
  const result = scored.slice(0, maxBlocks).map(s => s.block)
  if (!result.some(b => b.category === 'testing')) {
    const testing = BUILDING_BLOCKS.find(b => b.category === 'testing')
    if (testing) result.push(testing)
  }
  return result
}

/**
 * Connector blocks are opt-in integrations: only surface them when the goal
 * actually references them, so they never bloat a build that does not need them.
 */
function connectorKeywordScore(block: BuildingBlock, haystack: string): number {
  // Keyword-only — deliberately ignores block-name words so a connector is
  // pulled in solely by explicit intent (e.g. the word "local" in a block name
  // must never drag the storage connector into an unrelated local-first app).
  let score = 0
  for (const kw of block.keywords) {
    if (keywordHit(haystack, kw)) score += 1
  }
  return score
}

function selectRelevantConnectors(goal: string, context = ''): BuildingBlock[] {
  const haystack = `${goal} ${context}`.toLowerCase()
  return BUILDING_BLOCKS
    .filter(b => b.category.startsWith('connector-'))
    .map(b => ({ b, score: connectorKeywordScore(b, haystack) }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(s => s.b)
}

/**
 * Render the catalog block for the agent prompt.
 * Returns '' when no blocks are relevant.
 */
export function buildBuildingBlocksCatalog(
  goal: string,
  context = '',
  repoRoot: string = process.cwd(),
): string {
  const root = buildingBlocksRoot(repoRoot)

  // If a bundle matches the app type, present its curated set; otherwise pick by keyword.
  const bundle = matchBundle(goal, context)
  const base = bundle ? bundleBlocks(bundle) : selectRelevantBlocks(goal, context)

  // Always append connectors the goal explicitly asks for (only where needed),
  // even on top of a curated bundle. Dedupe by id, keep bundle order first.
  const seen = new Set(base.map(b => b.id))
  const connectors = selectRelevantConnectors(goal, context).filter(b => !seen.has(b.id))
  const blocks = [...base, ...connectors]
  if (blocks.length === 0) return ''

  const lines: string[] = [
    '',
    '## Reusable Building Blocks (do NOT reinvent the wheel)',
    `Battle-tested scaffolds live in \`${root}\`. When a block below fits the task,`,
    'READ its files from that directory and adapt them instead of writing from scratch.',
    'Each block lists exactly when to use it. Skip blocks that do not apply.',
    '',
  ]

  if (bundle) {
    lines.push(`**Recommended bundle for this app: ${bundle.name}** — ${bundle.description}`)
    lines.push(`Build in this order: ${bundle.blockIds.join(' → ')}`)
    lines.push('')
  }

  for (const b of blocks) {
    lines.push(`### ${b.name}  \`[${b.category}]\``)
    lines.push(`${b.summary}`)
    lines.push(`**When:** ${b.whenToUse}`)
    if (b.dependencies.length) lines.push(`**Deps:** ${b.dependencies.join(', ')}`)
    lines.push('**Files to copy + adapt:**')
    for (const f of b.files) {
      lines.push(`  - read \`${path.join(root, b.category, path.basename(f.src))}\` → write \`${f.dest}\`${f.note ? `  (${f.note})` : ''}`)
    }
    if (b.setupSteps.length) {
      lines.push('**After copying:** ' + b.setupSteps.join('; '))
    }
    lines.push('')
  }

  return lines.join('\n')
}
