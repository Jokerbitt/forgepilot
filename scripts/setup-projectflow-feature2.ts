/**
 * ProjectFlow feature #2 — Teams, email invitations & task file attachments.
 * Deliberately exercises the new connector templates LIVE:
 *   - connector-email   → invitation + notification mails
 *   - connector-storage → task file attachments (local-disk default)
 *
 * Run: npx tsx scripts/setup-projectflow-feature2.ts
 */
import { randomUUID } from 'crypto'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '../src/lib/repositories/delegationRepository'

const TARGET_REPO = '/Users/svenbittl/dev/projectflow-saas'
const BUDGET = 10

const GOAL = 'Add team collaboration to ProjectFlow: workspaces/teams with members, email invitations to join a team, and file attachments on tasks. Build on the EXISTING app (Next.js 15, Prisma/SQLite, credentials auth, User/Project/Task/Comment/Activity models) — do not re-scaffold.'

const CONTEXT = `ProjectFlow is an existing, working project & task management SaaS.
Stack: Next.js 15 App Router, TypeScript strict (no \`any\`), Tailwind, Prisma + SQLite, Vitest, credentials auth (signed JWT cookie). Data layer in src/lib/db. Read the existing schema and code before changing anything.

REUSE the ForgePilot building blocks instead of writing integrations from scratch — their absolute paths are given in the "Reusable Building Blocks" section of this prompt. Specifically:
- Email connector (Resend/SMTP/console) for sending invitation emails — read its files and copy them into src/lib/email/. Default to the console provider in dev (no API key needed).
- File Storage connector (S3/local) for task attachments — read its files and copy them into src/lib/storage/. Default to the local-disk provider in dev.

Build this feature:
1. Prisma: add Team (id, name, ownerId→User), TeamMembership (teamId, userId, role enum [owner, admin, member]), Invitation (id, teamId, email, token, status enum [pending, accepted, expired], createdAt, expiresAt), and Attachment (id, taskId→Task, uploaderId→User, filename, storageKey, contentType, size, createdAt). Add a migration. Associate Projects with a Team (nullable teamId for backward compatibility).
2. Email connector: copy the email block; send an invitation email (console provider in dev) with an accept link /invite/[token].
3. Teams UI: a Team settings area — list members, invite by email (creates an Invitation + sends the mail), accept-invite page that adds the user to the team.
4. Storage connector: copy the storage block; on a task, allow uploading a file attachment (multipart route or server action) stored via storage().put(safeKey(...)), and list/download attachments on the task detail page.
5. Seed: extend the seed with a demo team, one membership, one pending invitation, and one task attachment record.
6. Tests: cover invitation create/accept logic and attachment metadata logic with Vitest.

Keep it consistent with existing architecture, UI primitives, toast, and dark theme. After a schema change, run prisma generate so the client has the new models. Commit your work.`

const DOD = [
  'Team, TeamMembership, Invitation, Attachment models + migration; Projects optionally linked to a Team',
  'Email connector copied into src/lib/email; invitation email sent (console provider in dev) with /invite/[token] link',
  'Team settings UI: list members, invite by email; accept-invite page adds the user to the team',
  'Storage connector copied into src/lib/storage; task file upload + list/download of attachments',
  'Seed extended (team, membership, pending invite, attachment); Vitest tests for invite + attachment logic',
  'prisma generate run after schema change; npm run build green; TypeScript 0 errors',
]

async function main() {
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const now = new Date().toISOString()
  const id = randomUUID()

  await repo.create({
    id,
    title: 'ProjectFlow Feature — Teams, Email-Einladungen & Datei-Anhänge',
    status: 'approved',
    executionRoute: 'local-agent',
    costEstimateUsd: BUDGET,
    targetRepo: TARGET_REPO,
    worktreeAppType: 'nextjs',
    tags: ['projectflow-feature', 'teams', 'connectors-live'],
    contract: {
      id: randomUUID(),
      workItemId: 'projectflow-teams',
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
  console.log(`FEATURE2_DELEGATION_ID=${id}`)
}

main().catch(err => { console.error(err); process.exit(1) }) // eslint-disable-line no-console
