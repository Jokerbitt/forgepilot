import { randomUUID } from 'crypto'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '../src/lib/repositories/delegationRepository'
const GOAL = 'Add realtime live updates and outbound notifications to ProjectFlow. The Kanban board should update in real time when a task moves or is created; send a notification (Slack/webhook, console in dev) when a task is assigned or an invitation is sent. Build on the EXISTING app — do not re-scaffold.'
const CONTEXT = `ProjectFlow is an existing Next.js 15 + TypeScript strict + Prisma/SQLite SaaS with a Kanban board (/projects/[id]), tasks, teams, invitations, credentials auth. Read the existing code first.
REUSE the ForgePilot connector templates (absolute paths in the Reusable Building Blocks section): connector-realtime (SSE broker + route + useEventStream hook) → copy into src/lib/realtime + the SSE route; connector-notify (Slack/webhook/console) → copy into src/lib/notify.
Build:
1. Realtime: copy the realtime connector. After a task is created/moved/updated (server action), broker.publish the change on a board channel. The board page subscribes via useEventStream and updates the UI live (optimistic + reconcile). Channel must be per-project and auth-checked.
2. Notifications: copy the notify connector. On task assignment and on invitation creation, call notify({title, level, context}) (console provider default in dev — no keys needed).
3. Tests: cover the broker publish/subscribe and the notify routing with Vitest.
Keep consistent with existing architecture, primitives, dark theme. prisma generate if schema changes. Commit your work.`
async function main() {
  const now = new Date().toISOString(); const id = randomUUID()
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  await repo.create({ id, title: 'ProjectFlow Feature — Realtime-Board & Notifications (Tier-2 Connectoren live)',
    status: 'approved', executionRoute: 'local-agent', costEstimateUsd: 10,
    targetRepo: '/Users/svenbittl/dev/projectflow-saas', worktreeAppType: 'nextjs',
    tags: ['projectflow-feature','realtime','notify','connectors-live'],
    contract: { id: randomUUID(), workItemId: 'projectflow-realtime', goal: GOAL, context: CONTEXT, taskType: 'feature',
      definitionOfDone: ['Realtime connector copied; board updates live on task create/move via SSE','Notify connector copied; notification on task assignment + invitation (console in dev)','Per-project channel is auth-checked','Vitest for broker + notify','prisma generate if needed; npm run build green; 0 TS errors'],
      riskClass: 'B', maxBudgetUsd: 10, allowedTools: ['Read','Write','Edit','Bash','Glob','Grep'],
      branchStrategy: 'feature', requiresApproval: false, privacyMode: 'local', createdAt: now },
    createdAt: now, updatedAt: now })
  console.log('RT_ID=' + id)
}
main().catch(e => { console.error(e); process.exit(1) })
