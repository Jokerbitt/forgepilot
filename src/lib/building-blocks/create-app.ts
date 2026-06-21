/**
 * create-app — token-free scaffolding.
 *
 * Instead of paying an LLM to write boilerplate, copy a bundle's vetted block
 * files straight into a target app. The agent then only writes the
 * app-SPECIFIC code on top — the biggest token-saving lever in the pipeline.
 *
 * Pure + filesystem only; no LLM, no network.
 */

import fs from 'fs'
import path from 'path'
import { BUILDING_BLOCKS } from './registry'
import { getBundle, bundleBlocks } from './bundles'
import { buildingBlocksRoot } from './catalog'
import type { BuildingBlock } from './types'

export interface PlannedFile {
  /** Absolute source template path. */
  srcAbs: string
  /** Destination path relative to the target app root. */
  dest: string
  blockId: string
}

export interface CreateAppPlan {
  blocks: BuildingBlock[]
  files: PlannedFile[]
  /** Merged, de-duplicated npm dependencies across all blocks. */
  dependencies: string[]
  /** Ordered, de-duplicated post-copy setup steps (block-prefixed). */
  setupSteps: string[]
}

export interface CreateAppResult {
  plan: CreateAppPlan
  written: string[]
  skipped: string[]
  missingTemplates: string[]
}

function resolveBlocks(options: { bundleId?: string; blockIds?: string[] }): BuildingBlock[] {
  if (options.bundleId) {
    const bundle = getBundle(options.bundleId)
    if (!bundle) throw new Error(`Unknown bundle: ${options.bundleId}`)
    return bundleBlocks(bundle)
  }
  if (options.blockIds && options.blockIds.length > 0) {
    return options.blockIds.map(id => {
      const block = BUILDING_BLOCKS.find(b => b.id === id)
      if (!block) throw new Error(`Unknown block: ${id}`)
      return block
    })
  }
  throw new Error('createApp requires bundleId or blockIds')
}

/** Build the copy plan without touching the filesystem (other than reading template paths). */
export function planCreateApp(options: {
  bundleId?: string
  blockIds?: string[]
  repoRoot?: string
}): CreateAppPlan {
  const root = buildingBlocksRoot(options.repoRoot ?? process.cwd())
  const blocks = resolveBlocks(options)

  const files: PlannedFile[] = []
  const deps = new Set<string>()
  const steps: string[] = []

  for (const block of blocks) {
    for (const dep of block.dependencies) deps.add(dep)
    for (const step of block.setupSteps) steps.push(`[${block.name}] ${step}`)
    for (const f of block.files) {
      files.push({
        srcAbs: path.join(root, block.category, path.basename(f.src)),
        dest: f.dest,
        blockId: block.id,
      })
    }
  }

  return {
    blocks,
    files,
    dependencies: [...deps].sort(),
    setupSteps: steps,
  }
}

/**
 * Execute the plan: copy template files into `targetDir`.
 * Never overwrites existing files (records them as skipped) unless force=true.
 * dryRun returns the plan without writing.
 */
export function createApp(options: {
  bundleId?: string
  blockIds?: string[]
  targetDir: string
  repoRoot?: string
  force?: boolean
  dryRun?: boolean
}): CreateAppResult {
  const plan = planCreateApp(options)
  const written: string[] = []
  const skipped: string[] = []
  const missingTemplates: string[] = []

  for (const file of plan.files) {
    if (!fs.existsSync(file.srcAbs)) {
      missingTemplates.push(file.srcAbs)
      continue
    }
    const destAbs = path.join(options.targetDir, file.dest)
    if (fs.existsSync(destAbs) && !options.force) {
      skipped.push(file.dest)
      continue
    }
    if (!options.dryRun) {
      fs.mkdirSync(path.dirname(destAbs), { recursive: true })
      fs.copyFileSync(file.srcAbs, destAbs)
    }
    written.push(file.dest)
  }

  return { plan, written, skipped, missingTemplates }
}

export interface AutoScaffoldResult {
  scaffolded: boolean
  reason: string
  bundleId?: string
  fileCount?: number
  dependencies?: string[]
}

/**
 * Pre-scaffold a FRESH workspace from the blocks a build goal actually needs —
 * copying vetted block files with ZERO LLM tokens before the agent starts.
 * The agent then writes only the app-specific code on top.
 *
 * `resolveBlockIds(goal, context)` decides WHICH blocks to copy. Scope it to the
 * goal (not the whole bundle): the A/B finding showed full-bundle scaffolds cost
 * MORE because the agent must read + adapt dead-weight files. Return [] to skip.
 *
 * Guard: only runs on a genuinely empty app (no package.json yet), so it never
 * disturbs an existing codebase or a chained phase building on prior work.
 */
export function autoScaffoldWorkspace(options: {
  workspacePath: string
  goal: string
  context?: string
  repoRoot?: string
  resolveBlockIds: (goal: string, context?: string) => string[]
}): AutoScaffoldResult {
  const { workspacePath, goal, context = '', repoRoot, resolveBlockIds } = options

  if (fs.existsSync(path.join(workspacePath, 'package.json'))) {
    return { scaffolded: false, reason: 'Workspace ist nicht leer (package.json existiert)' }
  }
  const blockIds = resolveBlockIds(goal, context)
  if (blockIds.length === 0) {
    return { scaffolded: false, reason: 'Keine bedarfsgerechten Blöcke für das Ziel' }
  }

  const result = createApp({ blockIds, targetDir: workspacePath, repoRoot, force: false })
  if (result.written.length === 0) {
    return { scaffolded: false, reason: 'Keine Dateien kopiert' }
  }

  // Drop a note so the exploring agent adapts the scaffold instead of recreating it.
  const note = [
    `# Pre-scaffolded blocks: ${blockIds.join(', ')}`,
    '',
    `${result.written.length} starter files were copied in BEFORE you started.`,
    'READ and ADAPT them — do NOT rewrite them from scratch.',
    '',
    '## Install these dependencies first',
    '```',
    `npm i ${result.plan.dependencies.join(' ')}`,
    '```',
    '',
    '## Setup steps',
    ...result.plan.setupSteps.map(s => `- ${s}`),
    '',
    'Files copied:',
    ...result.written.map(f => `- ${f}`),
  ].join('\n')
  try {
    fs.writeFileSync(path.join(workspacePath, 'SCAFFOLD.md'), `${note}\n`, 'utf-8')
  } catch { /* note is best-effort */ }

  return {
    scaffolded: true,
    reason: `${blockIds.length} Blöcke bedarfsgerecht vorab kopiert`,
    fileCount: result.written.length,
    dependencies: result.plan.dependencies,
  }
}

/** Human-readable summary for logs / CLI output. */
export function summarizeCreateApp(result: CreateAppResult): string {
  const lines: string[] = []
  lines.push(`${result.written.length} Dateien kopiert, ${result.skipped.length} übersprungen`)
  if (result.plan.dependencies.length) {
    lines.push(`npm i ${result.plan.dependencies.join(' ')}`)
  }
  if (result.missingTemplates.length) {
    lines.push(`⚠️ ${result.missingTemplates.length} Template(s) fehlen`)
  }
  return lines.join('\n')
}
