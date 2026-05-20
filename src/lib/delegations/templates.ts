/**
 * Delegation Templates — M127
 *
 * Pre-built templates for common development tasks.
 * Each template fills in goal, acceptanceCriteria, skillCategory,
 * riskClass, and branchStrategy so users only need to adjust specifics.
 */

export type TemplateCategory = 'feature' | 'bugfix' | 'test' | 'refactor' | 'docs' | 'infra'

export interface DelegationTemplate {
  id: string
  name: string
  description: string
  emoji: string
  category: TemplateCategory
  goal: string
  acceptanceCriteria: string[]
  skillCategory: 'api-route' | 'ui-component' | 'data-model' | 'test' | 'refactor' | 'infrastructure' | 'documentation'
  riskClass: 'A' | 'B' | 'C'
  branchStrategy: 'feature' | 'fix' | 'chore'
  requiresApproval: boolean
  privacyMode: 'local' | 'private-cloud' | 'public'
  maxBudgetUsd: number
  context?: string
}

export const DELEGATION_TEMPLATES: DelegationTemplate[] = [
  // ─── API Routes ────────────────────────────────────────────────────────────
  {
    id: 'add-api-route',
    name: 'Add API Route',
    description: 'Create a new Next.js API route with Zod validation and tests',
    emoji: '🔌',
    category: 'feature',
    goal: 'Create a new Next.js 14 App Router API route at [PATH] that [DESCRIPTION]. Use Zod schema validation via parseBody(), return structured JSON responses, and add at least 3 Vitest tests.',
    acceptanceCriteria: [
      'Route file created at src/app/api/[path]/route.ts with export const dynamic = "force-dynamic"',
      'POST body validated with parseBody() + Zod schema from src/lib/validation/schemas.ts',
      'Returns { ok: true, data } on success and { error, fields } on validation failure',
      'At least 3 tests in route.test.ts (happy path, validation error, edge case)',
      'npm run type-check passes with 0 errors',
      'npm run test:run passes',
    ],
    skillCategory: 'api-route',
    riskClass: 'A',
    branchStrategy: 'feature',
    requiresApproval: false,
    privacyMode: 'local',
    maxBudgetUsd: 2,
    context: 'Stack: Next.js 14 App Router, TypeScript strict, Zod for validation (src/lib/validation/), Pino for logging (src/lib/logger/)',
  },

  // ─── Bug Fixes ─────────────────────────────────────────────────────────────
  {
    id: 'fix-bug',
    name: 'Fix Bug',
    description: 'Investigate and fix a specific bug with regression test',
    emoji: '🐛',
    category: 'bugfix',
    goal: 'Fix the bug: [DESCRIBE BUG]. Root cause: [IF KNOWN]. Add a regression test to prevent recurrence.',
    acceptanceCriteria: [
      'Bug is fixed and no longer reproducible',
      'Root cause identified and documented in a code comment',
      'Regression test added that would have caught the bug',
      'No unrelated changes outside the bug fix scope',
      'npm run type-check and npm run test:run pass',
    ],
    skillCategory: 'api-route',
    riskClass: 'A',
    branchStrategy: 'fix',
    requiresApproval: false,
    privacyMode: 'local',
    maxBudgetUsd: 1,
    context: 'Fix only the reported bug. Do not refactor surrounding code unless directly related to the fix.',
  },

  // ─── Tests ─────────────────────────────────────────────────────────────────
  {
    id: 'add-tests',
    name: 'Add Tests',
    description: 'Add comprehensive Vitest test coverage for an existing module',
    emoji: '🧪',
    category: 'test',
    goal: 'Add comprehensive Vitest tests for [FILE/MODULE]. Cover: happy path, edge cases, error handling, and boundary conditions.',
    acceptanceCriteria: [
      'Test file created at [module].test.ts alongside the source file',
      'Happy path tested with realistic inputs',
      'Error cases covered (invalid input, missing data, etc.)',
      'At least 80% branch coverage for the tested module',
      'Tests use vi.mock() for external dependencies (fs, fetch, env vars)',
      'All tests pass with npm run test:run',
    ],
    skillCategory: 'test',
    riskClass: 'A',
    branchStrategy: 'chore',
    requiresApproval: false,
    privacyMode: 'local',
    maxBudgetUsd: 1.5,
    context: 'Use Vitest (not Jest). Mock file system operations with vi.mock(). Use beforeEach to reset mocks.',
  },

  // ─── UI Components ─────────────────────────────────────────────────────────
  {
    id: 'add-ui-component',
    name: 'Add UI Component',
    description: 'Create a new React component with Tailwind CSS styling',
    emoji: '🎨',
    category: 'feature',
    goal: 'Create a new React component [NAME] at src/components/[path] that [DESCRIPTION]. Use Tailwind CSS, follow the existing dark-theme design system.',
    acceptanceCriteria: [
      'Component file created with proper TypeScript props interface',
      'Follows dark theme (bg-gray-900, border-gray-700, text-gray-100 etc.)',
      'Uses existing primitives from src/components/ui/primitives.tsx where possible',
      'Component is responsive (works on mobile and desktop)',
      'No inline styles — only Tailwind classes',
      'npm run type-check passes',
    ],
    skillCategory: 'ui-component',
    riskClass: 'A',
    branchStrategy: 'feature',
    requiresApproval: false,
    privacyMode: 'local',
    maxBudgetUsd: 2,
    context: 'Design system: dark theme, gray-900 backgrounds, violet/indigo accents. See src/components/ui/primitives.tsx for existing Button, Badge, Panel, EmptyState components.',
  },

  // ─── Refactoring ───────────────────────────────────────────────────────────
  {
    id: 'refactor-module',
    name: 'Refactor Module',
    description: 'Refactor an existing module for clarity, performance, or maintainability',
    emoji: '♻️',
    category: 'refactor',
    goal: 'Refactor [FILE/MODULE] to [GOAL: improve readability / reduce duplication / improve performance / split into smaller functions]. Keep all existing tests passing.',
    acceptanceCriteria: [
      'All existing tests still pass after refactoring',
      'No behavior changes — purely structural improvements',
      'Reduced complexity (fewer nested conditions, shorter functions)',
      'No new TypeScript errors introduced',
      'If public API changed: update all callers',
    ],
    skillCategory: 'refactor',
    riskClass: 'A',
    branchStrategy: 'chore',
    requiresApproval: false,
    privacyMode: 'local',
    maxBudgetUsd: 1.5,
    context: 'Do not change behavior. If in doubt, keep the existing implementation and only extract helper functions.',
  },

  // ─── Data Model ────────────────────────────────────────────────────────────
  {
    id: 'extend-data-model',
    name: 'Extend Data Model',
    description: 'Add fields to an existing TypeScript model and update all affected code',
    emoji: '📐',
    category: 'feature',
    goal: 'Add [FIELDS] to the [MODEL] interface in [FILE]. Update: JSON store read/write, API routes that use this model, and any UI that displays these fields.',
    acceptanceCriteria: [
      'New fields added to TypeScript interface with proper types',
      'New fields are optional (?) to maintain backward compatibility with existing JSON data',
      'JSON store: default values set when fields are missing (migration safety)',
      'API routes updated to handle new fields',
      'npm run type-check passes with 0 errors',
    ],
    skillCategory: 'data-model',
    riskClass: 'B',
    branchStrategy: 'feature',
    requiresApproval: true,
    privacyMode: 'local',
    maxBudgetUsd: 2,
    context: 'Data is stored in config/*.json files. Always make new fields optional for backward compatibility.',
  },

  // ─── Documentation ─────────────────────────────────────────────────────────
  {
    id: 'write-docs',
    name: 'Write Documentation',
    description: 'Document an existing module, API route, or feature',
    emoji: '📄',
    category: 'docs',
    goal: 'Write documentation for [MODULE/FEATURE]: JSDoc comments for all exported functions, a README section explaining usage, and inline comments for non-obvious logic.',
    acceptanceCriteria: [
      'All exported functions have JSDoc comments with @param and @returns',
      'Complex logic has inline comments explaining "why" not "what"',
      'Example usage provided in comments or README',
      'No code changes — documentation only',
      'npm run type-check passes',
    ],
    skillCategory: 'documentation',
    riskClass: 'A',
    branchStrategy: 'chore',
    requiresApproval: false,
    privacyMode: 'local',
    maxBudgetUsd: 0.5,
  },

  // ─── Infrastructure ────────────────────────────────────────────────────────
  {
    id: 'add-cron-job',
    name: 'Add Cron Job',
    description: 'Create a new Vercel cron job endpoint with CRON_SECRET auth',
    emoji: '⏱️',
    category: 'infra',
    goal: 'Create a new Vercel cron job at /api/cron/[NAME] that [DESCRIPTION]. Add to vercel.json with schedule "[CRON_SCHEDULE]".',
    acceptanceCriteria: [
      'Route at src/app/api/cron/[name]/route.ts with export const runtime = "nodejs"',
      'Authorization header check: Bearer ${CRON_SECRET} — return 401 if missing in production',
      'Structured logging with dsgvoLogger or apiLogger from src/lib/logger/',
      'Added to vercel.json crons array with correct schedule',
      'At least 2 tests: authorized call succeeds, unauthorized call returns 401',
      'npm run type-check and npm run test:run pass',
    ],
    skillCategory: 'infrastructure',
    riskClass: 'B',
    branchStrategy: 'feature',
    requiresApproval: true,
    privacyMode: 'local',
    maxBudgetUsd: 1,
    context: 'See src/app/api/cron/retention/route.ts for the reference implementation. CRON_SECRET is in .env.local.',
  },
]

/**
 * Get all templates, optionally filtered by category.
 */
export function getTemplates(category?: TemplateCategory): DelegationTemplate[] {
  if (!category) return DELEGATION_TEMPLATES
  return DELEGATION_TEMPLATES.filter(t => t.category === category)
}

/**
 * Get a single template by ID.
 */
export function getTemplate(id: string): DelegationTemplate | undefined {
  return DELEGATION_TEMPLATES.find(t => t.id === id)
}

/**
 * Convert a template to a partial TaskContract for pre-filling the delegation form.
 */
export function templateToContract(template: DelegationTemplate) {
  return {
    goal:               template.goal,
    acceptanceCriteria: template.acceptanceCriteria,
    skillCategory:      template.skillCategory,
    riskClass:          template.riskClass,
    branchStrategy:     template.branchStrategy,
    requiresApproval:   template.requiresApproval,
    privacyMode:        template.privacyMode,
    maxBudgetUsd:       template.maxBudgetUsd,
    context:            template.context ?? '',
  }
}
