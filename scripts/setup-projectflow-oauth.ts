/**
 * ProjectFlow feature #3 — OAuth social login (Google + GitHub).
 * Exercises the connector-oauth template LIVE.
 *
 * Run: npx tsx scripts/setup-projectflow-oauth.ts
 */
import { randomUUID } from 'crypto'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '../src/lib/repositories/delegationRepository'

const TARGET_REPO = '/Users/svenbittl/dev/projectflow-saas'
const BUDGET = 10

const GOAL = 'Add OAuth social login (Google + GitHub) to ProjectFlow alongside the existing credentials login, sharing the same session. Build on the EXISTING app — do not re-scaffold.'

const CONTEXT = `ProjectFlow is an existing, working SaaS: Next.js 15 App Router, TypeScript strict (no \`any\`), Tailwind, Prisma + SQLite, credentials auth with a signed JWT session cookie (see src/lib/auth/session.ts, cookie pf_session) and a User model. Read the existing auth + db code before changing anything.

REUSE the ForgePilot OAuth connector instead of writing the flow from scratch — its absolute paths are in the "Reusable Building Blocks" section of this prompt (connector-oauth: providers.ts, start-route.ts, callback-route.ts). Read those files and copy them into src/lib/oauth and the API routes, then ADAPT the callback to this app's session + db.

Build this feature:
1. Copy the OAuth connector into src/lib/oauth/providers.ts and the two API routes
   (/api/auth/oauth/[provider] and .../callback).
2. Extend the Prisma User model so an account can link an external OAuth identity:
   add OAuthAccount (id, userId→User, provider enum [google, github], externalId,
   createdAt, unique [provider, externalId]). Add a migration.
3. Adapt the callback: on success, upsert the User by email (create if new),
   link/ensure an OAuthAccount row, then mint a pf_session via the existing
   createSessionToken() and set the cookie — reusing this app's session module.
4. UI: add "Continue with Google" and "Continue with GitHub" buttons to the login
   page, styled with the existing primitives/theme. Show an error toast/message if
   ?error= is present.
5. Graceful when unconfigured: if the provider env vars are missing, the buttons
   should explain that OAuth is not configured rather than crash.
6. Tests: cover the user-upsert + account-link logic and the state/CSRF check with Vitest.

Keep consistent with existing architecture + dark theme. Run prisma generate after the schema change. Commit your work.`

const DOD = [
  'OAuth connector copied into src/lib/oauth + the two API routes',
  'OAuthAccount model + migration; callback upserts User by email and links the account',
  'Callback mints the existing pf_session cookie via createSessionToken (shared session)',
  'Login page has Google + GitHub buttons; missing env is handled gracefully (no crash)',
  'Vitest tests for upsert/link + CSRF-state logic',
  'prisma generate run; npm run build green; TypeScript 0 errors',
]

async function main() {
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const now = new Date().toISOString()
  const id = randomUUID()
  await repo.create({
    id,
    title: 'ProjectFlow Feature — OAuth-Login (Google/GitHub, Connector live)',
    status: 'approved',
    executionRoute: 'local-agent',
    costEstimateUsd: BUDGET,
    targetRepo: TARGET_REPO,
    worktreeAppType: 'nextjs',
    tags: ['projectflow-feature', 'oauth', 'connectors-live'],
    contract: {
      id: randomUUID(),
      workItemId: 'projectflow-oauth',
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
  console.log(`OAUTH_DELEGATION_ID=${id}`) // eslint-disable-line no-console
}

main().catch(err => { console.error(err); process.exit(1) }) // eslint-disable-line no-console
