/**
 * Atomic Task Decomposer
 *
 * Breaks a high-level delegation goal into small, atomic sub-tasks.
 * Each sub-task touches ≤ 3 files and has clear acceptance criteria.
 * Small tasks = less drift, more reliable results.
 */

import type { AgentType, SkillCategory } from './agent-skills'
import { getBestAgentForCategory } from './agent-skills'

export type TaskEffort = 'S' | 'M' | 'L'
export type AtomicTaskStatus = 'pending' | 'assigned' | 'running' | 'done' | 'failed' | 'skipped'

export interface AtomicTask {
  id: string
  title: string
  description: string
  acceptanceCriteria: string[]
  skillCategory: SkillCategory
  assignedAgentType: AgentType
  filePatterns: string[]
  effort: TaskEffort
  dependsOn: string[]
  order: number
}

// ─── Decomposition Patterns ───────────────────────────────────────────────────

interface DecomposePattern {
  keywords: string[]
  tasks: (goal: string) => Omit<AtomicTask, 'id' | 'order'>[]
}

const PATTERNS: DecomposePattern[] = [
  {
    keywords: ['api', 'route', 'endpoint', 'rest'],
    tasks: (goal) => [
      {
        title: 'Define types and interfaces',
        description: `Extract shared types for: ${goal}`,
        acceptanceCriteria: ['All types in src/lib/', 'No types exported from route files', 'TypeScript 0 errors'],
        skillCategory: 'data-model',
        assignedAgentType: getBestAgentForCategory('data-model'),
        filePatterns: ['src/lib/**/*.ts'],
        effort: 'S',
        dependsOn: [],
      },
      {
        title: 'Implement API route handler',
        description: `Build the API route for: ${goal}`,
        acceptanceCriteria: ['Only HTTP handler exports (GET/POST/etc)', 'Returns NextResponse.json()', '422 on invalid input'],
        skillCategory: 'api-route',
        assignedAgentType: getBestAgentForCategory('api-route'),
        filePatterns: ['src/app/api/**/*.ts'],
        effort: 'M',
        dependsOn: [],
      },
      {
        title: 'Write route tests',
        description: `Vitest tests covering happy path and error cases for: ${goal}`,
        acceptanceCriteria: ['≥ 3 test cases', 'Happy path + error case + edge case', 'All tests pass'],
        skillCategory: 'test',
        assignedAgentType: getBestAgentForCategory('test'),
        filePatterns: ['src/app/api/**/*.test.ts'],
        effort: 'S',
        dependsOn: [],
      },
    ],
  },
  {
    keywords: ['ui', 'component', 'page', 'dashboard', 'panel', 'modal', 'screen'],
    tasks: (goal) => [
      {
        title: 'Define component props and types',
        description: `Types for the UI component: ${goal}`,
        acceptanceCriteria: ['Props interface defined', 'No any types', 'TypeScript 0 errors'],
        skillCategory: 'data-model',
        assignedAgentType: getBestAgentForCategory('data-model'),
        filePatterns: ['src/types/**/*.ts', 'src/lib/**/*.ts'],
        effort: 'S',
        dependsOn: [],
      },
      {
        title: 'Build React component',
        description: `Implement the UI for: ${goal}`,
        acceptanceCriteria: ['Uses Tailwind only', 'Responsive', 'Loading + empty states handled', 'No direct API calls in component (use fetch hooks)'],
        skillCategory: 'ui-component',
        assignedAgentType: getBestAgentForCategory('ui-component'),
        filePatterns: ['src/components/**/*.tsx', 'src/app/**/*.tsx'],
        effort: 'M',
        dependsOn: [],
      },
      {
        title: 'Wire to API and add to navigation',
        description: `Connect component to backend + add nav entry if needed for: ${goal}`,
        acceptanceCriteria: ['Fetches real data', 'Error state shown', 'Nav link added if new page'],
        skillCategory: 'api-route',
        assignedAgentType: getBestAgentForCategory('api-route'),
        filePatterns: ['src/app/**/*.tsx', 'src/components/shared/AppNav.tsx'],
        effort: 'S',
        dependsOn: [],
      },
    ],
  },
  {
    keywords: ['model', 'schema', 'type', 'domain', 'data structure'],
    tasks: (goal) => [
      {
        title: 'Design and implement domain model',
        description: `Create TypeScript types for: ${goal}`,
        acceptanceCriteria: ['All fields typed (no any)', 'Optional vs required fields correct', 'Exported from src/lib/models/'],
        skillCategory: 'data-model',
        assignedAgentType: getBestAgentForCategory('data-model'),
        filePatterns: ['src/lib/models/**/*.ts'],
        effort: 'S',
        dependsOn: [],
      },
      {
        title: 'Implement file-based store',
        description: `CRUD store with atomic writes for: ${goal}`,
        acceptanceCriteria: ['Atomic write (tmp → rename)', 'Read returns typed object', 'Handles missing file gracefully'],
        skillCategory: 'infrastructure',
        assignedAgentType: getBestAgentForCategory('infrastructure'),
        filePatterns: ['src/lib/**/*-store.ts'],
        effort: 'M',
        dependsOn: [],
      },
    ],
  },
  {
    keywords: ['test', 'spec', 'coverage', 'vitest'],
    tasks: (goal) => [
      {
        title: 'Audit existing test coverage',
        description: `Find untested code paths for: ${goal}`,
        acceptanceCriteria: ['List of untested functions', 'Priority order identified'],
        skillCategory: 'test',
        assignedAgentType: getBestAgentForCategory('test'),
        filePatterns: ['src/**/*.test.ts'],
        effort: 'S',
        dependsOn: [],
      },
      {
        title: 'Write missing tests',
        description: `Add Vitest tests for: ${goal}`,
        acceptanceCriteria: ['All happy paths covered', 'Error cases covered', '0 test failures'],
        skillCategory: 'test',
        assignedAgentType: getBestAgentForCategory('test'),
        filePatterns: ['src/**/*.test.ts'],
        effort: 'M',
        dependsOn: [],
      },
    ],
  },
  {
    keywords: ['refactor', 'clean', 'extract', 'move', 'rename', 'reorganize'],
    tasks: (goal) => [
      {
        title: 'Identify refactor scope',
        description: `Audit files to change for: ${goal}`,
        acceptanceCriteria: ['List of files to touch', 'Dependencies mapped'],
        skillCategory: 'refactor',
        assignedAgentType: getBestAgentForCategory('refactor'),
        filePatterns: ['src/**/*.ts', 'src/**/*.tsx'],
        effort: 'S',
        dependsOn: [],
      },
      {
        title: 'Execute refactor',
        description: `Make the code changes for: ${goal}`,
        acceptanceCriteria: ['TypeScript 0 errors', 'All existing tests still pass', 'No behavior change'],
        skillCategory: 'refactor',
        assignedAgentType: getBestAgentForCategory('refactor'),
        filePatterns: ['src/**/*.ts', 'src/**/*.tsx'],
        effort: 'M',
        dependsOn: [],
      },
    ],
  },
]

const FALLBACK_TASKS = (goal: string): Omit<AtomicTask, 'id' | 'order'>[] => [
  {
    title: 'Research and plan',
    description: `Understand existing code, identify files to change for: ${goal}`,
    acceptanceCriteria: ['Affected files listed', 'Approach documented in PR description'],
    skillCategory: 'documentation',
    assignedAgentType: 'claude-code',
    filePatterns: ['src/**/*'],
    effort: 'S',
    dependsOn: [],
  },
  {
    title: 'Implement core changes',
    description: `Make the code changes for: ${goal}`,
    acceptanceCriteria: ['TypeScript 0 errors', 'Tests pass', 'Lint 0 errors'],
    skillCategory: 'infrastructure',
    assignedAgentType: 'claude-code',
    filePatterns: ['src/**/*'],
    effort: 'M',
    dependsOn: [],
  },
]

// ─── Public API ───────────────────────────────────────────────────────────────

export function decomposeTask(goal: string, context?: string): AtomicTask[] {
  const combined = `${goal} ${context ?? ''}`.toLowerCase()

  for (const pattern of PATTERNS) {
    if (pattern.keywords.some(kw => combined.includes(kw))) {
      return pattern.tasks(goal).map((t, i) => ({
        ...t,
        id: `task-${Date.now()}-${i}`,
        order: i,
      }))
    }
  }

  return FALLBACK_TASKS(goal).map((t, i) => ({
    ...t,
    id: `task-${Date.now()}-${i}`,
    order: i,
  }))
}

export function effortMinutes(effort: TaskEffort): number {
  return { S: 15, M: 45, L: 120 }[effort]
}
