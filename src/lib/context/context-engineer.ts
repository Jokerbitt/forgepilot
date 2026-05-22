/**
 * Context Engineer
 *
 * Builds the optimal context for each AI task by:
 * 1. Selecting relevant layers based on task type and token budget
 * 2. Scrubbing PII before any external API call (DSGVO Art. 5)
 * 3. Compressing to fit within the model's context window
 *
 * Context Stack (highest priority first):
 *   [1] Task layer     — title, description, acceptance criteria (always included)
 *   [2] Code layer     — relevant source files matched via filePatterns
 *   [3] Skill layer    — skill-specific guidance for the task category
 *   [4] Convention     — project conventions (CLAUDE.md summary, ADRs)
 *   [5] Memory         — last 3 relevant knowledge cards / escalations
 */

import fs from 'fs'
import path from 'path'
import { scrubPII } from './pii-scrubber'
import { getDocsDir, getDataDir } from '@/lib/config/paths'
import type { ScrubResult } from './pii-scrubber'

export interface ContextLayer {
  name: string
  content: string
  tokens: number   // approximate (1 token ≈ 4 chars)
  priority: number // 1 = highest, 5 = lowest
}

export interface BuiltContext {
  layers: ContextLayer[]
  totalTokens: number
  budget: number
  utilization: number  // 0-1
  piiScrub: ScrubResult
  assembled: string    // final string to inject into prompt
}

// Token budget per model class
const TOKEN_BUDGETS: Record<string, number> = {
  'claude-haiku-4-5':        4_000,
  'claude-sonnet-4-5':       8_000,
  'claude-opus-4-5':        12_000,
  'gpt-4o-mini':             6_000,
  'gpt-4o':                 10_000,
  'llama-3.1-8b-instant':    3_000,
  'llama-3.3-70b-versatile': 6_000,
  'gemini-2.0-flash':        8_000,
  default:                   4_000,
}

function approxTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

function getTokenBudget(modelId: string): number {
  return TOKEN_BUDGETS[modelId] ?? TOKEN_BUDGETS.default
}

export interface ContextBuildInput {
  taskTitle: string
  taskDescription: string
  acceptanceCriteria: string[]
  skillCategory?: string
  filePatterns?: string[]
  modelId?: string
  /** Extra context text to include (e.g. delegation contract context) */
  extraContext?: string
}

/** Build optimized context for a task */
export async function buildContext(input: ContextBuildInput): Promise<BuiltContext> {
  const budget  = getTokenBudget(input.modelId ?? 'default')
  const layers: ContextLayer[] = []
  let usedTokens = 0

  // ── Layer 1: Task (always included, highest priority) ────────────────
  const taskContent = [
    `## Task\n${input.taskTitle}`,
    input.taskDescription ? `\n${input.taskDescription}` : '',
    input.acceptanceCriteria.length
      ? `\n\n## Definition of Done\n${input.acceptanceCriteria.map(c => `- ${c}`).join('\n')}`
      : '',
    input.extraContext ? `\n\n## Context\n${input.extraContext}` : '',
  ].join('')

  const taskTokens = approxTokens(taskContent)
  layers.push({ name: 'task', content: taskContent, tokens: taskTokens, priority: 1 })
  usedTokens += taskTokens

  // ── Layer 2: Source files (matched via filePatterns) ─────────────────
  if (input.filePatterns && input.filePatterns.length > 0 && usedTokens < budget * 0.7) {
    const codeContent = fetchRelevantFiles(input.filePatterns, Math.floor((budget - usedTokens) * 0.5))
    if (codeContent) {
      const codeTokens = approxTokens(codeContent)
      layers.push({ name: 'code', content: codeContent, tokens: codeTokens, priority: 2 })
      usedTokens += codeTokens
    }
  }

  // ── Layer 3: Skill guidance ───────────────────────────────────────────
  if (input.skillCategory && usedTokens < budget * 0.85) {
    const skillContent = fetchSkillGuidance(input.skillCategory)
    if (skillContent) {
      const skillTokens = approxTokens(skillContent)
      if (usedTokens + skillTokens <= budget * 0.9) {
        layers.push({ name: 'skill', content: skillContent, tokens: skillTokens, priority: 3 })
        usedTokens += skillTokens
      }
    }
  }

  // ── Layer 4: Project conventions ─────────────────────────────────────
  if (usedTokens < budget * 0.9) {
    const convContent = fetchConventions()
    if (convContent) {
      const convTokens = approxTokens(convContent)
      if (usedTokens + convTokens <= budget) {
        layers.push({ name: 'conventions', content: convContent, tokens: convTokens, priority: 4 })
        usedTokens += convTokens
      }
    }
  }

  // ── Layer 5: Knowledge memory ─────────────────────────────────────────
  if (usedTokens < budget * 0.95) {
    const memContent = fetchRecentKnowledge(input.skillCategory, input.taskDescription)
    if (memContent) {
      const memTokens = approxTokens(memContent)
      if (usedTokens + memTokens <= budget) {
        layers.push({ name: 'memory', content: memContent, tokens: memTokens, priority: 5 })
        usedTokens += memTokens
      }
    }
  }

  // ── Assemble and PII-scrub ────────────────────────────────────────────
  const rawAssembled = layers.map(l => l.content).join('\n\n---\n\n')
  const piiScrub     = scrubPII(rawAssembled)

  return {
    layers,
    totalTokens: usedTokens,
    budget,
    utilization: usedTokens / budget,
    piiScrub,
    assembled: piiScrub.scrubbed,
  }
}

// ── Layer fetchers ────────────────────────────────────────────────────────────

function fetchRelevantFiles(patterns: string[], maxTokens: number): string {
  const projectRoot = process.cwd()
  const found: string[] = []
  let tokenCount = 0

  for (const pattern of patterns) {
    // Convert glob-like pattern to directory scan
    const dir = pattern.split('*')[0].replace(/\/$/, '') || 'src'
    const ext = pattern.includes('*.ts') ? ['.ts', '.tsx'] : ['.ts', '.tsx', '.js', '.json']
    const fullDir = path.join(projectRoot, dir)

    if (!fs.existsSync(fullDir)) continue

    try {
      const files = fs.readdirSync(fullDir, { withFileTypes: true })
      for (const f of files) {
        if (!f.isFile()) continue
        if (!ext.some(e => f.name.endsWith(e))) continue
        if (f.name.includes('.test.') || f.name.includes('.spec.')) continue

        const filePath = path.join(fullDir, f.name)
        const content  = fs.readFileSync(filePath, 'utf-8').slice(0, 2000)
        const snippet  = `### ${path.join(dir, f.name)}\n\`\`\`typescript\n${content}\n\`\`\``
        const tokens   = approxTokens(snippet)

        if (tokenCount + tokens > maxTokens) break
        found.push(snippet)
        tokenCount += tokens
      }
    } catch {
      // skip unreadable dirs
    }
    if (tokenCount >= maxTokens) break
  }

  return found.length > 0 ? `## Relevant Files\n\n${found.join('\n\n')}` : ''
}

function fetchSkillGuidance(skillCategory: string): string {
  const docsDir  = getDocsDir()
  const skillMap: Record<string, string[]> = {
    'api-route':          ['Agent_Skills/skill-context-fetch.md'],
    'react-component':    ['Agent_Skills/skill-writeback.md'],
    'database-migration': ['Agent_Skills/skill-verify.md'],
    'refactor':           ['Agent_Skills/skill-task-pick.md'],
  }

  const files = skillMap[skillCategory] ?? []
  if (!files.length || !docsDir) return ''

  const snippets: string[] = []
  for (const f of files) {
    const p = path.join(docsDir, f)
    if (fs.existsSync(p)) {
      snippets.push(fs.readFileSync(p, 'utf-8').slice(0, 800))
    }
  }

  return snippets.length > 0 ? `## Skill Guidance\n\n${snippets.join('\n\n')}` : ''
}

function fetchConventions(): string {
  const root      = process.cwd()
  const claudeMd  = path.join(root, 'CLAUDE.md')
  if (!fs.existsSync(claudeMd)) return ''

  // Only include first 1000 chars of CLAUDE.md (conventions, not full doc)
  const content = fs.readFileSync(claudeMd, 'utf-8').slice(0, 1000)
  return `## Project Conventions (excerpt)\n\n${content}`
}

// Card types surfaced in the context window — excludes 'risk' (too noisy)
// and 'requirement' (handled via task layer).
const KNOWLEDGE_TYPES = new Set(['learning', 'context', 'pattern', 'decision', 'reference'])

function scoreKnowledgeCard(
  card: { title: string; body: string; tags: string[]; type: string },
  terms: string[],
): number {
  if (terms.length === 0) return 1
  const titleL = card.title.toLowerCase()
  const bodyL  = card.body.toLowerCase()
  let score = 0
  for (const t of terms) {
    if (titleL.includes(t)) score += 10
    if (bodyL.includes(t))  score += 2
    if (card.tags.some(tag => tag.toLowerCase().includes(t))) score += 4
  }
  return score
}

function fetchRecentKnowledge(skillCategory?: string, goal?: string): string {
  try {
    const storePath = path.join(getDataDir(), 'knowledge-store.json')
    if (!fs.existsSync(storePath)) return ''

    const store = JSON.parse(fs.readFileSync(storePath, 'utf-8')) as {
      cards: Array<{ title: string; body: string; tags: string[]; type: string }>
    }

    // Collect search terms from skill category + goal keywords
    const terms: string[] = [
      ...(skillCategory ? [skillCategory.toLowerCase()] : []),
      ...(goal ? goal.toLowerCase().split(/\s+/).filter(w => w.length > 4).slice(0, 8) : []),
    ]

    const scored = store.cards
      .filter(c => KNOWLEDGE_TYPES.has(c.type))
      .map(c => ({ card: c, score: scoreKnowledgeCard(c, terms) }))
      .filter(({ score }) => score > 0 || terms.length === 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)

    if (!scored.length) return ''

    const snippets = scored.map(({ card }) => `**[${card.type}] ${card.title}**\n${card.body.slice(0, 300)}`)
    return `## Relevant Knowledge\n\n${snippets.join('\n\n')}`
  } catch {
    return ''
  }
}
