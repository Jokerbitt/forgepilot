/**
 * One-off setup: create a 4-phase chained delegation that autonomously builds
 * "ProjectFlow" — a professional project/task-management SaaS — into a target repo.
 *
 * Each phase reuses the previous phase's persistent workspace (chainNextId →
 * chainedFromId), so phase N builds directly on phase N-1's code.
 *
 * Run with: npx tsx scripts/setup-projectflow-build.ts
 * Then trigger phase 1 via the running dev server:
 *   curl -X POST http://localhost:3000/api/delegations/<firstId>/execute
 */
import { randomUUID } from 'crypto'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '../src/lib/repositories/delegationRepository'
import type { RiskClass } from '../src/lib/models/work-item'

const TARGET_REPO = '/Users/svenbittl/dev/projectflow-saas'
const BUDGET_PER_PHASE = 10
const APP = 'ProjectFlow'

interface Phase {
  title: string
  goal: string
  context: string
  dod: string[]
  riskClass: RiskClass
}

const SHARED_STACK = `Stack: Next.js 15 (App Router), TypeScript strict (no \`any\`), Tailwind CSS, Prisma + SQLite (file-based, zero external deps), Vitest. Single-tenant local-first SaaS. Keep all data in a local SQLite DB via Prisma. Commit your work with git.`

const PHASES: Phase[] = [
  {
    title: 'Phase 1 — Fundament & App-Shell',
    goal: `Scaffold ${APP}, a professional project & task management SaaS. Set up the Next.js 15 + TypeScript + Tailwind foundation with a polished app shell (sidebar navigation, top bar, responsive layout, dark theme) and a landing page.`,
    context: `${SHARED_STACK}
This is PHASE 1 of 4. Build ONLY the foundation — do not build features yet.
Deliver: working Next.js 15 app that builds and runs; Tailwind configured; an app shell layout component (sidebar with nav links: Dashboard, Projects, Tasks, Settings; top bar with app name); a marketing landing page at "/" with hero + feature highlights + CTA; an empty Dashboard page at /dashboard. Set up Vitest with one passing smoke test. Add a README.`,
    dod: [
      'npm run build is green (Next.js production build succeeds)',
      'TypeScript: 0 errors',
      'App shell with sidebar (Dashboard, Projects, Tasks, Settings) renders',
      'Landing page at / with hero, features, CTA',
      'Vitest set up with at least 1 passing test',
    ],
    riskClass: 'B',
  },
  {
    title: 'Phase 2 — Datenmodell, Prisma & Auth',
    goal: `Add the data layer and authentication to ${APP}. Define the Prisma schema (User, Project, Task, with relations and enums for task status/priority), seed data, and a credentials-based session login.`,
    context: `${SHARED_STACK}
This is PHASE 2 of 4. Build on the EXISTING Phase 1 code — do not re-scaffold.
Deliver: Prisma schema with User, Project (name, description, owner), Task (title, description, status enum [todo, in_progress, done], priority enum [low, medium, high], dueDate, projectId, assigneeId); migrations applied to local SQLite; a seed script with demo data; a typed data-access layer (lib/db). Add simple credentials auth: a login page, a session cookie, route protection for /dashboard and feature pages, and a logout action. Do NOT store plaintext passwords — hash them.`,
    dod: [
      'Prisma schema with User, Project, Task (status + priority enums, relations)',
      'Migration applied; SQLite DB created; seed script populates demo data',
      'Credentials login + session cookie + protected routes + logout',
      'Passwords hashed (no plaintext)',
      'npm run build green, TypeScript 0 errors, tests pass',
    ],
    riskClass: 'B',
  },
  {
    title: 'Phase 3 — Kern-Features: Projekte, Tasks, Board, Dashboard',
    goal: `Build the core product of ${APP}: full CRUD for projects and tasks, a Kanban board (drag between todo/in_progress/done), task detail with priority & due date, and a real dashboard with stats.`,
    context: `${SHARED_STACK}
This is PHASE 3 of 4. Build on the EXISTING Phase 1+2 code (schema, auth, app shell).
Deliver: Projects list + create/edit/delete; per-project Kanban board with three columns (todo/in_progress/done) where moving a task updates its status; task create/edit with title, description, priority, due date, assignee; a Dashboard showing real stats (total projects, open tasks, tasks by status, overdue tasks) computed from the DB. Use API routes + server actions backed by Prisma. Toast notifications on create/update/delete. Cover the core logic with Vitest tests.`,
    dod: [
      'Projects: list, create, edit, delete (persisted via Prisma)',
      'Kanban board: 3 columns, moving a task changes its status in the DB',
      'Task editor: title, description, priority, due date, assignee',
      'Dashboard with real stats (projects, open/overdue tasks, by status)',
      'Vitest tests for core CRUD/board logic; npm run build green; 0 TS errors',
    ],
    riskClass: 'B',
  },
  {
    title: 'Phase 4 — Settings, Billing & Politur',
    goal: `Finish ${APP} as a professional SaaS: a Settings area (profile, preferences), a Stripe-style billing/subscription page (mock checkout, plan tiers), empty/loading/error states, and overall UI polish + documentation.`,
    context: `${SHARED_STACK}
This is PHASE 4 of 4 (final). Build on the EXISTING Phase 1-3 code.
Deliver: Settings page (update display name, theme/preferences persisted); a Billing page with plan tiers (Free / Pro / Team), current-plan indicator, and a mock "Upgrade" checkout flow (no real Stripe keys — simulate the subscription state in the DB); polished empty states, loading skeletons, and error boundaries across pages; accessibility pass (labels, focus states); a DOCS.md describing the architecture and a FUNCTIONAL_TESTS.md manual test plan. Ensure the full app builds, all tests pass, and it runs end-to-end.`,
    dod: [
      'Settings page persists profile + preferences',
      'Billing page with Free/Pro/Team tiers + mock upgrade flow (subscription state in DB)',
      'Empty/loading/error states + a11y polish across the app',
      'DOCS.md + FUNCTIONAL_TESTS.md written',
      'Full app: npm run build green, all Vitest tests pass, 0 TS errors',
    ],
    riskClass: 'B',
  },
]

async function main() {
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const now = new Date().toISOString()
  const ids = PHASES.map(() => randomUUID())
  const planTag = `projectflow-${Date.now()}`

  for (let i = 0; i < PHASES.length; i++) {
    const phase = PHASES[i]!
    const id = ids[i]!
    const nextId = ids[i + 1] ?? undefined

    await repo.create({
      id,
      title: `[${i + 1}/${PHASES.length}] ${phase.title}`,
      status: i === 0 ? 'approved' : 'pending',
      executionRoute: 'local-agent',
      costEstimateUsd: BUDGET_PER_PHASE,
      chainNextId: nextId,
      chainPosition: i,
      targetRepo: TARGET_REPO,
      worktreeAppType: 'nextjs',
      tags: [`build:${planTag}`, `phase:${i + 1}`],
      contract: {
        id: randomUUID(),
        workItemId: planTag,
        goal: phase.goal,
        context: phase.context,
        taskType: 'feature',
        definitionOfDone: phase.dod,
        riskClass: phase.riskClass,
        maxBudgetUsd: BUDGET_PER_PHASE,
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
    console.log(`Created phase ${i + 1}: ${id} (${phase.title})${nextId ? ` → next ${nextId}` : ''}`)
  }

  // eslint-disable-next-line no-console
  console.log(`\nFIRST_DELEGATION_ID=${ids[0]}`)
  // eslint-disable-next-line no-console
  console.log(`Trigger: curl -X POST http://localhost:3000/api/delegations/${ids[0]}/execute`)
}

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})
