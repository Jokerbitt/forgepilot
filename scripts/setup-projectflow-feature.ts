/**
 * Extend the EXISTING ProjectFlow SaaS with a new feature via one ForgePilot
 * delegation (single phase, builds against the current target repo).
 *
 * Proves the now-automatic runtime bootstrap: the new Prisma migration + seed
 * run on their own after writeback.
 *
 * Run: npx tsx scripts/setup-projectflow-feature.ts
 * Then: curl -X POST http://localhost:3000/api/delegations/<id>/execute
 */
import { randomUUID } from 'crypto'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '../src/lib/repositories/delegationRepository'

const TARGET_REPO = '/Users/svenbittl/dev/projectflow-saas'
const BUDGET = 10

const GOAL = 'Add real-time-style team collaboration to ProjectFlow: per-task comments and an automatic activity timeline. Build on the EXISTING app (Next.js 15, Prisma/SQLite, credentials auth, existing User/Project/Task models) — do not re-scaffold.'

const CONTEXT = `ProjectFlow is an existing, working project & task management SaaS.
Stack: Next.js 15 App Router, TypeScript strict (no \`any\`), Tailwind, Prisma + SQLite, Vitest, credentials auth (signed JWT cookie). Data layer lives in src/lib/db. Task detail is at /projects/[id] (Kanban) and /tasks. Read the existing schema and code before changing anything.

Build this feature:
1. Prisma: add a Comment model (id, body, taskId→Task, authorId→User, createdAt) and an Activity model (id, taskId→Task, actorId→User, type enum [created, status_changed, priority_changed, commented, assigned], meta JSON/string, createdAt). Add a migration.
2. Server actions / data layer: create a comment on a task; list comments + activity for a task (merged, newest first). When a task's status/priority/assignee changes via the existing editor, also write an Activity row.
3. UI: in the task detail view, add a Comments section (threaded list with author + relative time, an "Add comment" textarea) and an Activity timeline (human-readable lines like "Demo User moved this to In progress"). Use the existing UI primitives, toast, and dark theme.
4. Seed: extend the seed script with a few demo comments and activity entries so the feature is visible immediately.
5. Tests: cover the comment-create and activity-logging logic with Vitest.

Keep it consistent with the existing architecture and styling. Commit your work.`

const DOD = [
  'Comment + Activity Prisma models added with a migration',
  'Creating a comment persists it and shows in the task detail comments thread',
  'Task status/priority/assignee changes write an Activity row; timeline renders human-readable lines',
  'Seed extended with demo comments + activity',
  'Vitest tests for comment-create and activity-logging; npm run build green; TypeScript 0 errors',
]

async function main() {
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const now = new Date().toISOString()
  const id = randomUUID()

  await repo.create({
    id,
    title: 'ProjectFlow Feature — Task-Kommentare & Activity-Timeline',
    status: 'approved',
    executionRoute: 'local-agent',
    costEstimateUsd: BUDGET,
    targetRepo: TARGET_REPO,
    worktreeAppType: 'nextjs',
    tags: ['projectflow-feature', 'collaboration'],
    contract: {
      id: randomUUID(),
      workItemId: 'projectflow-collab',
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

  // eslint-disable-next-line no-console
  console.log(`FEATURE_DELEGATION_ID=${id}`)
  // eslint-disable-next-line no-console
  console.log(`Trigger: curl -X POST http://localhost:3000/api/delegations/${id}/execute`)
}

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})
