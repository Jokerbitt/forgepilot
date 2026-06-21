/**
 * #50 measurement build — a FRESH SaaS foundation that triggers the create-app
 * pre-scaffold (the target repo has no package.json yet). Single phase, same
 * shape as ProjectFlow Phase 1 ($3.16, NO pre-scaffold) so the cost is a fair
 * A/B comparison of the token-saving lever.
 *
 * Run: npx tsx scripts/setup-feedbackhub-measure.ts
 */
import { randomUUID } from 'crypto'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '../src/lib/repositories/delegationRepository'

const TARGET_REPO = '/Users/svenbittl/dev/feedbackhub-saas'
const BUDGET = 10

const GOAL = 'Scaffold FeedbackHub, a customer feedback & feature-request SaaS platform with subscription billing. Build the foundation: Next.js 15 + TypeScript + Tailwind, an app shell (sidebar: Dashboard, Boards, Settings), a landing page, and Vitest set up. A pre-scaffolded starter from the saas-starter bundle has been copied in — READ SCAFFOLD.md and ADAPT those files, do not recreate them.'

const CONTEXT = `Stack: Next.js 15 (App Router), TypeScript strict (no \`any\`), Tailwind, Prisma + SQLite, Vitest. Single-tenant local-first SaaS.
IMPORTANT: a starter scaffold from the "saas-starter" bundle was copied into this repo BEFORE you started — read SCAFFOLD.md first, install the listed deps, and ADAPT the copied files (app shell, db client, auth, settings, etc.) instead of writing them from scratch.
Deliver a foundation that builds (npm run build green), a polished app shell + landing page, and at least one passing Vitest test. Keep it to the foundation — no feature pages beyond the shell. Commit your work.`

const DOD = [
  'Adapt the pre-scaffolded SCAFFOLD.md files instead of recreating them',
  'npm run build green (Next.js production build)',
  'App shell with sidebar (Dashboard, Boards, Settings) + landing page',
  'TypeScript 0 errors; at least 1 passing Vitest test',
]

async function main() {
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const now = new Date().toISOString()
  const id = randomUUID()
  await repo.create({
    id,
    title: 'FeedbackHub — Fundament (Pre-Scaffold-Messung)',
    status: 'approved',
    executionRoute: 'local-agent',
    costEstimateUsd: BUDGET,
    targetRepo: TARGET_REPO,
    worktreeAppType: 'nextjs',
    tags: ['measurement', 'pre-scaffold'],
    contract: {
      id: randomUUID(),
      workItemId: 'feedbackhub-foundation',
      goal: GOAL,
      context: CONTEXT,
      taskType: 'feature',
      definitionOfDone: DOD,
      riskClass: 'B',
      maxBudgetUsd: BUDGET,
      allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
      branchStrategy: 'feature',
      requiresApproval: false,
      privacyMode: 'local',
      createdAt: now,
    },
    createdAt: now,
    updatedAt: now,
  })
  console.log(`MEASURE_DELEGATION_ID=${id}`) // eslint-disable-line no-console
}

main().catch(err => { console.error(err); process.exit(1) }) // eslint-disable-line no-console
