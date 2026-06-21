/**
 * prompt-skill-registry.ts — Versioned, metrics-tracked prompt skill fragments.
 *
 * A "prompt skill" is a reusable text fragment injected into agent prompts.
 * Skills are tracked, versioned, and evolved based on execution outcomes.
 * This enables ForgePilot to learn which instructions lead to better results
 * and continuously improve token efficiency.
 */

import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

function registryFile(): string {
  return path.join(process.cwd(), 'config', 'prompt-skills.json')
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type SkillScope = 'global' | 'feature' | 'bug-fix' | 'test' | 'ui-component' | 'review' | 'refactor' | 'docs' | 'infra'
export type SkillStatus = 'active' | 'draft' | 'deprecated' | 'testing'
export type SkillSource = 'builtin' | 'user' | 'extracted' | 'imported'

export interface SkillMetrics {
  runsCount: number
  avgQualityScore: number     // 0-100
  avgTokensSaved: number      // vs. baseline without this skill
  successRate: number         // 0-1
  lastUsedAt?: string
  trend: 'improving' | 'stable' | 'declining' | 'unknown'
}

export interface PromptSkill {
  id: string
  name: string
  version: string             // semver: "1.0.0"
  scope: SkillScope           // when this skill is injected
  status: SkillStatus
  source: SkillSource
  description: string
  content: string             // The actual text injected into the prompt
  /** Dynamic placeholders: {{recentFailures}}, {{codebaseStyle}}, etc. */
  isDynamic: boolean
  tags: string[]
  metrics: SkillMetrics
  /** Skills this one replaces (for migration tracking) */
  supersedes?: string[]
  createdAt: string
  updatedAt: string
}

interface Registry {
  skills: PromptSkill[]
  lastOptimizedAt?: string
}

// ─── Persistence ──────────────────────────────────────────────────────────────

function read(): Registry {
  try {
    if (!fs.existsSync(registryFile())) return { skills: [] }
    return JSON.parse(fs.readFileSync(registryFile(), 'utf-8')) as Registry
  } catch {
    return { skills: [] }
  }
}

function write(reg: Registry): void {
  const tmp = `${registryFile()}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(reg, null, 2))
  fs.renameSync(tmp, registryFile())
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export function listSkills(opts?: { scope?: SkillScope; status?: SkillStatus; source?: SkillSource }): PromptSkill[] {
  let skills = read().skills
  if (opts?.scope) skills = skills.filter(s => s.scope === opts.scope || s.scope === 'global')
  if (opts?.status) skills = skills.filter(s => s.status === opts.status)
  if (opts?.source) skills = skills.filter(s => s.source === opts.source)
  return skills.sort((a, b) => b.metrics.avgQualityScore - a.metrics.avgQualityScore)
}

export function getSkill(id: string): PromptSkill | null {
  return read().skills.find(s => s.id === id) ?? null
}

export function createSkill(input: Omit<PromptSkill, 'id' | 'createdAt' | 'updatedAt'>): PromptSkill {
  const reg = read()
  const now = new Date().toISOString()
  const skill: PromptSkill = { ...input, id: randomUUID(), createdAt: now, updatedAt: now }
  reg.skills.push(skill)
  write(reg)
  return skill
}

export function updateSkill(id: string, patch: Partial<Omit<PromptSkill, 'id' | 'createdAt'>>): PromptSkill | null {
  const reg = read()
  const idx = reg.skills.findIndex(s => s.id === id)
  if (idx < 0) return null
  const updated = { ...reg.skills[idx]!, ...patch, updatedAt: new Date().toISOString() }
  reg.skills[idx] = updated
  write(reg)
  return updated
}

export function deleteSkill(id: string): boolean {
  const reg = read()
  const before = reg.skills.length
  reg.skills = reg.skills.filter(s => s.id !== id)
  if (reg.skills.length === before) return false
  write(reg)
  return true
}

// ─── Metrics Recording ────────────────────────────────────────────────────────

export interface SkillRunOutcome {
  skillId: string
  qualityScore: number        // 0-100
  tokensSaved: number         // positive = this skill helped reduce tokens vs. alternative
  success: boolean
  recordedAt: string
}

export function recordSkillOutcome(outcome: SkillRunOutcome): void {
  const skill = getSkill(outcome.skillId)
  if (!skill) return
  const m = skill.metrics
  const n = m.runsCount
  // Running average
  const avgQ = (m.avgQualityScore * n + outcome.qualityScore) / (n + 1)
  const avgT = (m.avgTokensSaved * n + outcome.tokensSaved) / (n + 1)
  const successes = Math.round(m.successRate * n) + (outcome.success ? 1 : 0)
  // Trend: compare latest quality to existing average
  const trend: SkillMetrics['trend'] =
    outcome.qualityScore > m.avgQualityScore + 5 ? 'improving'
    : outcome.qualityScore < m.avgQualityScore - 5 ? 'declining'
    : 'stable'
  updateSkill(outcome.skillId, {
    metrics: {
      runsCount: n + 1,
      avgQualityScore: Math.round(avgQ),
      avgTokensSaved: Math.round(avgT),
      successRate: successes / (n + 1),
      lastUsedAt: outcome.recordedAt,
      trend,
    },
  })
}

// ─── Assembly ─────────────────────────────────────────────────────────────────

/**
 * Returns all active skills for a given scope, assembled into a single
 * prompt block. Skills with higher quality score appear first.
 * Dynamic placeholders are filled with provided context.
 */
export function assembleSkillBlock(
  scope: SkillScope,
  context: { recentFailures?: string; codebaseStyle?: string } = {},
): string {
  const active = listSkills({ scope, status: 'active' })
  if (active.length === 0) return ''

  const blocks = active.map(skill => {
    let content = skill.content
    if (skill.isDynamic) {
      content = content
        .replace('{{recentFailures}}', context.recentFailures ?? '')
        .replace('{{codebaseStyle}}', context.codebaseStyle ?? '')
    }
    return content.trim()
  })

  return `\n## Skill Instructions\n${blocks.join('\n\n')}\n`
}

// ─── Seeding ──────────────────────────────────────────────────────────────────

/** Seed built-in skills if the registry is empty */
export function seedBuiltinSkills(): void {
  const reg = read()
  if (reg.skills.length > 0) return

  const builtins: Omit<PromptSkill, 'id' | 'createdAt' | 'updatedAt'>[] = [
    {
      name: 'no-scope-drift',
      version: '1.0.0',
      scope: 'global',
      status: 'active',
      source: 'builtin',
      description: 'Prevents agents from touching files outside their assigned scope',
      content: `## Anti-Drift
- Only modify files directly required for this task. Touching unrelated files = scope drift.
- If you find a bug in an unrelated file: note it in the PR description, do NOT fix it now.
- Maximum 3 new dependencies. Adding packages requires justification in the commit message.`,
      isDynamic: false,
      tags: ['quality', 'scope', 'critical'],
      metrics: { runsCount: 0, avgQualityScore: 0, avgTokensSaved: 0, successRate: 0, trend: 'unknown' },
    },
    {
      name: 'checkpoint-protocol',
      version: '1.0.0',
      scope: 'feature',
      status: 'active',
      source: 'builtin',
      description: 'Structured checkpoints at 40% and 80% of turn budget',
      content: `## Checkpoint Protocol
- At 40% of your turn budget: stop, re-read the Goal and DoD, confirm you are on track.
- At 80% of your turn budget: if DoD not checkable yet, print ESCALATION: approaching turn limit.
- Every 10 turns: print PROGRESS: <what done> | <what next> | <turn N of MAX>`,
      isDynamic: false,
      tags: ['quality', 'checkpoints'],
      metrics: { runsCount: 0, avgQualityScore: 0, avgTokensSaved: 0, successRate: 0, trend: 'unknown' },
    },
    {
      name: 'typescript-strict',
      version: '1.0.0',
      scope: 'global',
      status: 'active',
      source: 'builtin',
      description: 'TypeScript strict mode rules for ForgePilot codebase',
      content: `## TypeScript Rules
- No \`any\` types. Use \`unknown\` + type guards, or define exact types.
- Discriminated unions over optional fields where possible.
- Run \`npm run type-check\` before every commit — 0 errors required.`,
      isDynamic: false,
      tags: ['typescript', 'quality', 'critical'],
      metrics: { runsCount: 0, avgQualityScore: 0, avgTokensSaved: 0, successRate: 0, trend: 'unknown' },
    },
    {
      name: 'test-coverage',
      version: '1.0.0',
      scope: 'feature',
      status: 'active',
      source: 'builtin',
      description: 'Test coverage requirements for feature work',
      content: `## Testing Rules
- Every new behavior needs a test. Co-locate tests: \`foo.ts\` → \`foo.test.ts\`.
- Run \`npm run test:run\` after every meaningful change.
- Cover: happy path, error path, edge cases (empty input, null, concurrent writes).
- Never skip or xfail existing tests.`,
      isDynamic: false,
      tags: ['testing', 'quality'],
      metrics: { runsCount: 0, avgQualityScore: 0, avgTokensSaved: 0, successRate: 0, trend: 'unknown' },
    },
    {
      name: 'failure-aware',
      version: '1.0.0',
      scope: 'global',
      status: 'active',
      source: 'builtin',
      description: 'Injects recent failure lessons dynamically (prevents repeating known mistakes)',
      content: `## Recent Failure Lessons
{{recentFailures}}`,
      isDynamic: true,
      tags: ['learning', 'failures', 'dynamic'],
      metrics: { runsCount: 0, avgQualityScore: 0, avgTokensSaved: 0, successRate: 0, trend: 'unknown' },
    },
  ]

  const now = new Date().toISOString()
  reg.skills = builtins.map(b => ({ ...b, id: randomUUID(), createdAt: now, updatedAt: now }))
  write(reg)
}
