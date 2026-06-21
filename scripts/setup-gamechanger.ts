/**
 * Parameterized ProjectFlow gamechanger feature builder.
 *   npx tsx scripts/setup-gamechanger.ts <feature-id>
 * Prints DELEGATION_ID=<id>. Builds on the EXISTING ProjectFlow (which already
 * has the AI copilot: src/lib/ai with mock/cloud/ollama + guardrails).
 */
import { randomUUID } from 'crypto'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '../src/lib/repositories/delegationRepository'
import type { RiskClass } from '../src/lib/models/work-item'

const TARGET = '/Users/svenbittl/dev/projectflow-saas'
const BUDGET = 12

const BASE = `ProjectFlow is an existing Next.js 15 + TypeScript strict + Prisma/SQLite SaaS: projects, tasks (status/priority/dueDate/assignee), comments, activity, teams, realtime board, credentials auth, AND an AI copilot already at src/lib/ai (provider-agnostic router with a MockProvider default — AI_MODE=mock — plus anthropic/ollama, wrapped by guardrails). REUSE the existing src/lib/ai and the ForgePilot connector templates whose absolute paths are in the Reusable Building Blocks section. Read existing code first. Everything must work in dev WITHOUT API keys (mock/console/local defaults). Build on the existing app — do not re-scaffold. prisma generate if schema changes. npm run build green. Commit your work.`

interface Feature { title: string; goal: string; context: string; dod: string[]; riskClass: RiskClass; tags: string[] }

const FEATURES: Record<string, Feature> = {
  'smart-priority': {
    title: 'ProjectFlow Gamechanger 1 — Smart Prioritization + Automation',
    goal: 'Add an AI "What should I do today?" prioritization view and a rules-based automation engine to ProjectFlow.',
    context: `${BASE}
REUSE connector-jobs (registry + cron route) and connector-notify (Slack/webhook/console).
Build:
1. Smart priority: a /today page + a server function that ranks the signed-in user\x27s open tasks by a deterministic score (overdue weight, due-soon, priority, status) AND asks the AI copilot for a short rationale / suggested order (mock provider gives a deterministic rationale). Show a ranked "Today" list with the reason.
2. Automation engine: an AutomationRule Prisma model (id, teamId/ownerId, trigger enum [task_overdue, task_unassigned, task_blocked], action enum [notify, reassign_to_owner, raise_priority], enabled). A cron job (connector-jobs) "run-automations" evaluates enabled rules over tasks and performs the action (notify via connector-notify, or a DB update), logging an Activity. A simple Settings/Automation UI to toggle rules. Migration + seed one demo rule.
3. Tests: priority scorer, rule evaluation, and the job with Vitest.`,
    dod: ['/today ranked task list with deterministic score + AI rationale (mock works)', 'AutomationRule model + migration; cron job evaluates rules and notifies/updates', 'connector-jobs + connector-notify copied and used', 'Automation settings UI to toggle rules; demo rule seeded', 'Vitest for scorer + rule eval; npm run build green; 0 TS errors'],
    riskClass: 'B',
    tags: ['gamechanger', 'smart-priority', 'connectors-live'],
  },
  'insights': {
    title: 'ProjectFlow Gamechanger 2 — Insights Dashboard',
    goal: 'Add an Insights dashboard with team velocity, burndown, status distribution, and bottleneck detection, plus product analytics tracking.',
    context: `${BASE}
REUSE connector-analytics (PostHog/console) for event tracking.
Build:
1. Insights page /insights: compute real metrics from the DB — tasks completed per week (velocity), open vs done over time (burndown-style), tasks by status/priority, overdue count, and a simple bottleneck signal (e.g. column with most stale tasks). Render with lightweight inline SVG/CSS charts (no heavy chart lib) or a tiny dep if needed.
2. Analytics: copy connector-analytics into src/lib/analytics; track key events (task.created, task.completed, generation.created) server-side via analytics() (console provider default, no keys).
3. Tests: the metric computations (velocity, burndown buckets, bottleneck) with Vitest.`,
    dod: ['/insights with velocity, burndown, status/priority distribution, overdue, bottleneck — real data', 'connector-analytics copied; key events tracked (console default)', 'Charts render (inline SVG/CSS or tiny dep)', 'Vitest for metric computations; npm run build green; 0 TS errors'],
    riskClass: 'B',
    tags: ['gamechanger', 'insights', 'connectors-live'],
  },
  'local-ai': {
    title: 'ProjectFlow Gamechanger 3 — Local-first KI (Ollama) + DSGVO-Modus',
    goal: 'Make the AI copilot switchable to local Ollama and add a privacy/DSGVO mode that forces local-only AI (no cloud calls), surfaced clearly in the UI.',
    context: `${BASE}
The AI router already has an ollama provider. Build:
1. Settings: an AI section to choose AI_MODE (mock | local/ollama | cloud) + model, persisted per user/workspace. When set to local, the router uses the Ollama provider; document OLLAMA_HOST/OLLAMA_MODEL env.
2. DSGVO/Privacy mode: a workspace setting "privacy mode" that, when ON, forces the router to refuse cloud providers (only mock or local allowed) and shows a badge "Local-only AI — no data leaves this machine" near AI features. The guardrails/router must HARD-enforce this (a cloud call while privacy mode is on throws / falls back to local).
3. Make it obvious in the AI Copilot UI which provider/mode is active (a small indicator).
4. Tests: router respects AI_MODE; privacy mode blocks cloud selection; mock still works as default.`,
    dod: ['Settings: AI_MODE (mock/local/cloud) + model persisted', 'Privacy/DSGVO mode hard-forces local-only AI (cloud blocked) with a clear UI badge', 'Active provider/mode indicator in the copilot UI', 'Vitest: AI_MODE routing + privacy-mode enforcement; npm run build green; 0 TS errors'],
    riskClass: 'B',
    tags: ['gamechanger', 'local-ai', 'dsgvo'],
  },
  'pdf-search': {
    title: 'ProjectFlow Gamechanger 4 — PDF-Reports + globale Suche',
    goal: 'Add PDF project status reports and a global full-text search across projects, tasks and comments.',
    context: `${BASE}
REUSE connector-pdf (renderPdf via pdf-lib) and connector-search (in-memory/Meilisearch).
Build:
1. PDF reports: copy connector-pdf; a "Download report" on a project produces a PDF with project meta, task table (by status), and summary totals (overdue, done, open). Route streams application/pdf. (npm i pdf-lib.)
2. Global search: copy connector-search; index projects, tasks (title+description) and comments into namespaces; a search box in the top bar + /search results page grouped by type, with links. Re-index on writes (or lazily). In-memory provider default (no keys).
3. Tests: the PDF spec builder and the search index/query with Vitest.`,
    dod: ['Project PDF report (meta + task table + totals) downloads as application/pdf', 'connector-pdf + connector-search copied and used', 'Global search box + /search results across projects/tasks/comments', 'Vitest for pdf spec + search; npm run build green; 0 TS errors'],
    riskClass: 'B',
    tags: ['gamechanger', 'pdf-search', 'connectors-live'],
  },
}

async function main() {
  const key = process.argv[2]
  const f = key ? FEATURES[key] : undefined
  if (!f) { console.error('Unknown feature. Use one of: ' + Object.keys(FEATURES).join(', ')); process.exit(1) }
  const now = new Date().toISOString()
  const id = randomUUID()
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  await repo.create({
    id, title: f.title, status: 'approved', executionRoute: 'local-agent', costEstimateUsd: BUDGET,
    targetRepo: TARGET, worktreeAppType: 'nextjs', tags: ['projectflow-feature', ...f.tags],
    contract: {
      id: randomUUID(), workItemId: `projectflow-${key}`, goal: f.goal, context: f.context, taskType: 'feature',
      definitionOfDone: f.dod, riskClass: f.riskClass, maxBudgetUsd: BUDGET,
      allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
      branchStrategy: 'feature', requiresApproval: false, privacyMode: 'local', createdAt: now,
    },
    createdAt: now, updatedAt: now,
  })
  console.log('DELEGATION_ID=' + id)
}
main().catch(e => { console.error(e); process.exit(1) })
