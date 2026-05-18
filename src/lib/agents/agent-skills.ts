/**
 * Agent Skill Registry
 *
 * Defines what each agent type can do, which files it owns,
 * and which tasks it should pick first.
 */

export type AgentType = 'claude-code' | 'codex' | 'antigravity' | 'general'

export type SkillCategory =
  | 'api-route'
  | 'ui-component'
  | 'data-model'
  | 'test'
  | 'refactor'
  | 'infrastructure'
  | 'documentation'

export interface AgentSkill {
  id: string
  name: string
  category: SkillCategory
  description: string
  /** File glob patterns this skill typically touches */
  filePatterns: string[]
  /** Confidence 0-100 */
  confidence: number
}

export interface AgentProfile {
  type: AgentType
  displayName: string
  strengths: SkillCategory[]
  weaknesses: SkillCategory[]
  maxConcurrentFiles: number
  skills: AgentSkill[]
}

// ─── Skill Definitions ────────────────────────────────────────────────────────

const SKILL_API_ROUTE: AgentSkill = {
  id: 'api-route',
  name: 'Next.js API Routes',
  category: 'api-route',
  description: 'Create GET/POST/PATCH/DELETE route handlers with proper typing',
  filePatterns: ['src/app/api/**/*.ts'],
  confidence: 95,
}

const SKILL_UI_COMPONENT: AgentSkill = {
  id: 'ui-component',
  name: 'React UI Components',
  category: 'ui-component',
  description: 'Build Tailwind-styled React components with proper TypeScript',
  filePatterns: ['src/components/**/*.tsx', 'src/app/**/page.tsx'],
  confidence: 90,
}

const SKILL_DATA_MODEL: AgentSkill = {
  id: 'data-model',
  name: 'Domain Models & Store',
  category: 'data-model',
  description: 'Design TypeScript interfaces and file-based JSON stores',
  filePatterns: ['src/lib/models/*.ts', 'src/lib/**/*-store.ts'],
  confidence: 95,
}

const SKILL_TEST: AgentSkill = {
  id: 'test',
  name: 'Vitest Tests',
  category: 'test',
  description: 'Write unit and integration tests for routes and lib functions',
  filePatterns: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  confidence: 90,
}

const SKILL_REFACTOR: AgentSkill = {
  id: 'refactor',
  name: 'Code Refactoring',
  category: 'refactor',
  description: 'Extract shared types to lib, fix imports, clean up exports',
  filePatterns: ['src/**/*.ts', 'src/**/*.tsx'],
  confidence: 85,
}

// ─── Agent Profiles ───────────────────────────────────────────────────────────

export const AGENT_PROFILES: Record<AgentType, AgentProfile> = {
  'claude-code': {
    type: 'claude-code',
    displayName: 'Claude Code',
    strengths: ['api-route', 'data-model', 'test', 'refactor'],
    weaknesses: ['ui-component'],
    maxConcurrentFiles: 8,
    skills: [SKILL_API_ROUTE, SKILL_DATA_MODEL, SKILL_TEST, SKILL_REFACTOR],
  },
  'codex': {
    type: 'codex',
    displayName: 'Codex',
    strengths: ['data-model', 'infrastructure', 'api-route'],
    weaknesses: ['ui-component'],
    maxConcurrentFiles: 6,
    skills: [SKILL_DATA_MODEL, SKILL_API_ROUTE, SKILL_TEST],
  },
  'antigravity': {
    type: 'antigravity',
    displayName: 'Antigravity',
    strengths: ['ui-component', 'refactor'],
    weaknesses: ['infrastructure', 'data-model'],
    maxConcurrentFiles: 5,
    skills: [SKILL_UI_COMPONENT, SKILL_TEST, SKILL_REFACTOR],
  },
  'general': {
    type: 'general',
    displayName: 'General Purpose',
    strengths: ['api-route', 'test', 'documentation'],
    weaknesses: [],
    maxConcurrentFiles: 4,
    skills: [SKILL_API_ROUTE, SKILL_TEST, SKILL_UI_COMPONENT],
  },
}

export function getAgentProfile(type: AgentType): AgentProfile {
  return AGENT_PROFILES[type]
}

export function getBestAgentForCategory(category: SkillCategory): AgentType {
  const scored = Object.entries(AGENT_PROFILES).map(([type, profile]) => ({
    type: type as AgentType,
    score: profile.strengths.includes(category) ? 2 : profile.weaknesses.includes(category) ? 0 : 1,
  }))
  return scored.sort((a, b) => b.score - a.score)[0].type
}
