/**
 * Codebase Scout — M108: Deeper context for agent runs.
 *
 * Finds files relevant to the current task goal by:
 * 1. Extracting keywords from goal + context
 * 2. Grepping for those keywords in src/ and config/
 * 3. Scoring and deduplicating matches
 * 4. Reading the first N chars of top matches
 *
 * Also reads key config files (tsconfig, vitest.config, package.json scripts)
 * that every agent should know about.
 */

import { execFileSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { readKnowledgeCards } from '@/lib/knowledge/knowledge-card'

export interface RelevantFile {
  path: string
  snippet: string
  reason: string
}

const SNIPPET_CHARS = 500
const MAX_FILES = 8

/** Extract meaningful search keywords from freeform text */
function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    // Remove common stop words
    .replace(/\b(the|a|an|and|or|for|in|on|at|to|of|with|from|by|is|are|was|were|be|been|has|have|will|can|should|must|that|this|as|it|its)\b/g, ' ')
    .split(/[\s\W]+/)
    .filter(w => w.length >= 4)
    .filter(w => !/^\d+$/.test(w))
    // Deduplicate
    .filter((w, i, arr) => arr.indexOf(w) === i)
    .slice(0, 8)
}

/** Score a file path — prefer src/lib, src/app/api, models */
function scoreFilePath(filePath: string): number {
  if (filePath.includes('/models/')) return 10
  if (filePath.includes('/lib/')) return 8
  if (filePath.includes('/api/')) return 7
  if (filePath.includes('/components/')) return 5
  if (filePath.includes('/app/')) return 4
  return 2
}

/**
 * Find files in the repo whose content matches the goal keywords.
 * Uses grep for speed — avoids loading all files into memory.
 */
export function findRelevantFiles(
  goal: string,
  context: string,
  repoPath: string,
  maxFiles = MAX_FILES,
  snippetChars = SNIPPET_CHARS,
): RelevantFile[] {
  const keywords = extractKeywords(`${goal} ${context}`)
  if (keywords.length === 0) return []

  const searchDirs = ['src', 'config'].map(d => join(repoPath, d)).filter(existsSync)
  if (searchDirs.length === 0) return []

  const fileScores = new Map<string, { score: number; reasons: string[] }>()

  for (const keyword of keywords) {
    try {
      // grep -rl: use execFileSync with args array (no shell interpolation) to avoid injection
      const safeKeyword = keyword.replace(/[^a-zA-Z0-9_.\-]/g, '')
      if (!safeKeyword) continue
      const output = execFileSync(
        'grep',
        ['-rl', '--include=*.ts', '--include=*.tsx', '--include=*.json', '-i',
          safeKeyword, ...searchDirs],
        { cwd: repoPath, encoding: 'utf8', timeout: 5000, maxBuffer: 1024 * 1024 },
      ).trim()

      if (!output) continue

      for (const filePath of output.split('\n')) {
        const trimmed = filePath.trim()
        if (!trimmed) continue
        // Skip test files, node_modules, .next
        if (trimmed.includes('.test.') || trimmed.includes('.spec.') || trimmed.includes('node_modules') || trimmed.includes('.next')) continue

        const existing = fileScores.get(trimmed)
        const pathScore = scoreFilePath(trimmed)
        if (existing) {
          existing.score += pathScore
          existing.reasons.push(keyword)
        } else {
          fileScores.set(trimmed, { score: pathScore, reasons: [keyword] })
        }
      }
    } catch {
      // grep returns exit code 1 when no match — not an error
    }
  }

  // Sort by score desc, take top N
  const sorted = Array.from(fileScores.entries())
    .sort(([, a], [, b]) => b.score - a.score)
    .slice(0, maxFiles)

  return sorted.map(([filePath, { reasons }]) => {
    let snippet = ''
    try {
      const full = readFileSync(filePath, 'utf8')
      snippet = full.slice(0, snippetChars)
      if (full.length > snippetChars) snippet += '\n  // ... (truncated)'
    } catch {
      snippet = '(could not read)'
    }

    // Make path relative for cleaner output
    const relativePath = filePath.startsWith(repoPath)
      ? filePath.slice(repoPath.length + 1)
      : filePath

    return {
      path: relativePath,
      snippet,
      reason: reasons.slice(0, 3).join(', '),
    }
  })
}

// In-process cache for readProjectConfig — config files don't change during a single server run
// Saves ~400ms of filesystem reads per delegation execution (CLAUDE.md + tsconfig + package.json)
const _configCache = new Map<string, { snap: ConfigSnapshot; cachedAt: number }>()
const CONFIG_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/** Key config files every agent should know */
const KEY_CONFIG_FILES = [
  'CLAUDE.md',
  'AGENTS.md',
  'tsconfig.json',
  'vitest.config.ts',
  'vitest.config.js',
]

export interface ConfigSnapshot {
  claudeMd?: string
  agentsMd?: string
  tsconfigPaths?: string
  testCommand?: string
  buildCommand?: string
}

/**
 * Read project config files relevant for agent orientation.
 * Returns a snapshot with the most important parts.
 * Results are cached for 5 minutes per repoPath to avoid repeated filesystem I/O.
 */
export function readProjectConfig(repoPath: string): ConfigSnapshot {
  const cached = _configCache.get(repoPath)
  if (cached && Date.now() - cached.cachedAt < CONFIG_CACHE_TTL_MS) {
    return cached.snap
  }

  const snap: ConfigSnapshot = {}

  // CLAUDE.md — project conventions (check root and .claude/ subdir)
  const claudePaths = [join(repoPath, 'CLAUDE.md'), join(repoPath, '.claude', 'CLAUDE.md')]
  for (const claudePath of claudePaths) {
    if (existsSync(claudePath)) {
      const raw = readFileSync(claudePath, 'utf8')
      snap.claudeMd = raw.slice(0, 1500) + (raw.length > 1500 ? '\n... (truncated)' : '')
      break
    }
  }

  // AGENTS.md — agent briefing
  const agentsPath = join(repoPath, 'AGENTS.md')
  if (existsSync(agentsPath)) {
    const raw = readFileSync(agentsPath, 'utf8')
    snap.agentsMd = raw.slice(0, 800) + (raw.length > 800 ? '\n... (truncated)' : '')
  }

  // tsconfig.json — path aliases agents need to know
  const tsconfigPath = join(repoPath, 'tsconfig.json')
  if (existsSync(tsconfigPath)) {
    try {
      const raw = readFileSync(tsconfigPath, 'utf8')
      const parsed = JSON.parse(raw) as { compilerOptions?: { paths?: Record<string, string[]> } }
      const paths = parsed.compilerOptions?.paths
      if (paths) {
        snap.tsconfigPaths = Object.entries(paths)
          .map(([alias, targets]) => `${alias} → ${targets[0]}`)
          .join('\n')
      }
    } catch {
      // JSON parse error — skip
    }
  }

  // package.json — test/build commands
  const pkgPath = join(repoPath, 'package.json')
  if (existsSync(pkgPath)) {
    try {
      const raw = readFileSync(pkgPath, 'utf8')
      const pkg = JSON.parse(raw) as { scripts?: Record<string, string> }
      snap.testCommand = pkg.scripts?.['test:run'] ?? pkg.scripts?.['test'] ?? 'npm test'
      snap.buildCommand = pkg.scripts?.['build'] ?? 'npm run build'
    } catch {
      snap.testCommand = 'npm test'
    }
  }

  _configCache.set(repoPath, { snap, cachedAt: Date.now() })
  return snap
}

/**
 * Return failure-lesson knowledge cards relevant to the given repo and goal.
 * Used by buildCodebaseContextBlock to inject past failure lessons into the agent prompt.
 */
export function findFailureLessons(
  repoPath: string,
  goal: string,
  maxLessons = 3,
): Array<{ title: string; content: string }> {
  try {
    const allCards = readKnowledgeCards()
    const lessons = allCards.filter(c => c.tags.includes('failure-lesson'))
    if (lessons.length === 0) return []

    const goalKeywords = extractKeywords(goal)

    return lessons
      .map(card => {
        let score = 0
        // Prefer cards for the same repo
        if (card.tags.includes(repoPath)) score += 10
        // Score by keyword overlap with current goal
        for (const kw of goalKeywords) {
          if (card.content.toLowerCase().includes(kw) || card.title.toLowerCase().includes(kw)) score += 1
        }
        return { card, score }
      })
      .sort((a, b) => b.score !== a.score ? b.score - a.score : b.card.createdAt.localeCompare(a.card.createdAt))
      .slice(0, maxLessons)
      .map(({ card }) => ({ title: card.title, content: card.content.slice(0, 400) }))
  } catch {
    return []
  }
}

/**
 * Build the "## Codebase Context" block for injection into the agent prompt.
 * @param minimal - when true, uses reduced SNIPPET_CHARS (200) and MAX_FILES (3)
 *   Saves ~800 tokens for bug-fix, test, refactor, ui-component tasks.
 */
export function buildCodebaseContextBlock(
  goal: string,
  context: string,
  repoPath: string,
  minimal = false,
): string {
  const snippetChars = minimal ? 200 : SNIPPET_CHARS
  const maxFiles = minimal ? 3 : MAX_FILES
  const config = readProjectConfig(repoPath)
  const relevantFiles = findRelevantFiles(goal, context, repoPath, maxFiles, snippetChars)

  const lines: string[] = []

  // CLAUDE.md first — highest priority
  if (config.claudeMd) {
    lines.push(`## Project Conventions (CLAUDE.md)\n\`\`\`\n${config.claudeMd}\n\`\`\``)
  } else if (config.agentsMd) {
    lines.push(`## Agent Briefing (AGENTS.md)\n\`\`\`\n${config.agentsMd}\n\`\`\``)
  }

  // TypeScript path aliases
  if (config.tsconfigPaths) {
    lines.push(`## TypeScript Path Aliases\n${config.tsconfigPaths}`)
  }

  // Test/build commands
  if (config.testCommand) {
    lines.push(`## Commands\n- Test: \`${config.testCommand}\`\n- Build: \`${config.buildCommand ?? 'npm run build'}\``)
  }

  // Relevant source files
  if (relevantFiles.length > 0) {
    const fileBlocks = relevantFiles.map(f =>
      `### ${f.path}\n\`\`\`ts\n${f.snippet}\n\`\`\``
    ).join('\n\n')
    lines.push(`## Relevant Source Files (read before writing any code)\n${fileBlocks}`)
  }

  // Failure lessons from past runs — agent memory for avoiding known pitfalls
  const lessons = findFailureLessons(repoPath, goal)
  if (lessons.length > 0) {
    const lessonBlocks = lessons.map(l => `### ${l.title}\n${l.content}`).join('\n\n')
    lines.push(`## Lessons from Previous Failed Runs (avoid these pitfalls)\n${lessonBlocks}`)
  }

  if (lines.length === 0) return ''
  return `\n\n---\n${lines.join('\n\n')}`
}
