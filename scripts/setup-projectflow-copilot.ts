import { randomUUID } from 'crypto'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '../src/lib/repositories/delegationRepository'
const GOAL = 'Add an AI Project Copilot to ProjectFlow — the gamechanger feature. (1) AI Task Generator: from a natural-language project goal, the AI proposes a list of tasks (title + priority + optional description) which the user can accept to create in bulk. (2) AI Project Summary: a button that asks the AI to summarize a project\x27s current state (tasks by status, overdue, recent activity) into a short standup-style paragraph. Build on the EXISTING app — do not re-scaffold. The AI MUST work in dev WITHOUT any API key.'
const CONTEXT = `ProjectFlow is an existing Next.js 15 + TypeScript strict + Prisma/SQLite SaaS: projects, tasks (status/priority/dueDate/assignee), comments, activity, teams, realtime board, credentials auth. Read existing code (src/lib/db, src/lib/tasks) first.
REUSE the ForgePilot AI building blocks (absolute paths in the Reusable Building Blocks section): ai-routing (provider-types, auto-router, anthropic-provider, ollama-provider) → copy into src/lib/ai; ai-guardrails (cost-guard, rate-limit, input-validation, pii-scrubber) → copy into src/lib/ai/guards. CRITICAL: add a MockProvider as the DEFAULT (AI_MODE=mock) that returns a deterministic, useful response (for task-generation it must return parseable structured tasks) so the copilot runs end-to-end with ZERO API keys.
Build:
1. AI core: copy ai-routing + ai-guardrails; MockProvider default; every AI call wrapped by guardrails (rate limit + PII scrub + injection check).
2. AI Task Generator: a server action / route that takes { projectId, goal } → AI returns a JSON array of tasks [{title, priority, description?}]; UI on the project page (input + "Generate tasks" → preview list → "Add all" creates them as real Tasks). The mock provider must return 3-6 sensible tasks derived from the goal text so this works without keys.
3. AI Project Summary: a route/action that gathers the project\x27s tasks+activity and asks the AI to summarize; UI button shows the standup paragraph. Mock returns a deterministic summary from the real stats.
4. Settings: an AI section (AI_MODE mock/cloud/local + model) consistent with existing settings.
5. Tests: cover the task-parse logic, the mock provider, and the guardrail wrapping with Vitest.
Keep consistent with existing architecture, primitives, dark theme. prisma generate if schema changes. npm run build green. Commit your work.`
async function main() {
  const now = new Date().toISOString(); const id = randomUUID()
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  await repo.create({ id, title: 'ProjectFlow GAMECHANGER — AI Project Copilot (ai-routing + guardrails live)',
    status: 'approved', executionRoute: 'local-agent', costEstimateUsd: 12,
    targetRepo: '/Users/svenbittl/dev/projectflow-saas', worktreeAppType: 'nextjs',
    tags: ['projectflow-feature','ai-copilot','gamechanger','connectors-live'],
    contract: { id: randomUUID(), workItemId: 'projectflow-copilot', goal: GOAL, context: CONTEXT, taskType: 'feature',
      definitionOfDone: ['ai-routing + ai-guardrails copied into src/lib/ai; MockProvider default (no API key needed)','AI Task Generator: goal -> proposed tasks -> bulk-create real Tasks; works with mock provider','AI Project Summary: standup-style summary from real project stats (mock deterministic)','Every AI call wrapped by guardrails (rate/PII/injection)','Settings AI section (AI_MODE + model)','Vitest for task-parse + mock provider + guardrails; prisma generate if needed; npm run build green; 0 TS errors'],
      riskClass: 'B', maxBudgetUsd: 12, allowedTools: ['Read','Write','Edit','Bash','Glob','Grep'],
      branchStrategy: 'feature', requiresApproval: false, privacyMode: 'local', createdAt: now },
    createdAt: now, updatedAt: now })
  console.log('COPILOT_ID=' + id)
}
main().catch(e => { console.error(e); process.exit(1) })
