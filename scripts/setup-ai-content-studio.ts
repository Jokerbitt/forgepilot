/**
 * Large AI SaaS proof build — "AI Content Studio".
 * 4 chained phases, ai-saas bundle, persistent workspace. Phase 1 triggers the
 * (now scoped) pre-scaffold. The AI must work in dev WITHOUT external keys via a
 * mock provider, so the app is reibungslos demoable.
 *
 * Run: npx tsx scripts/setup-ai-content-studio.ts
 */
import { randomUUID } from 'crypto'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '../src/lib/repositories/delegationRepository'
import type { RiskClass } from '../src/lib/models/work-item'

const TARGET_REPO = '/Users/svenbittl/dev/ai-content-studio'
const BUDGET_PER_PHASE = 12
const APP = 'AI Content Studio'

const SHARED = `Stack: Next.js 15 (App Router, React 19), TypeScript strict (no \`any\`), Tailwind, Prisma + SQLite (local-first, zero external deps), Vitest. ${APP} is a professional AI SaaS: users write prompts and get AI-generated marketing/blog content, with templates, generation history, usage credits and billing.

CRITICAL — the AI must work in dev WITHOUT any API key: implement a provider interface with a "mock" provider (echoes a deterministic, templated completion) as the DEFAULT (AI_MODE=mock), plus optional cloud (Anthropic/OpenAI) and local (Ollama) providers selected by env. The app must run and demo end-to-end with zero secrets.`

interface Phase { title: string; goal: string; context: string; dod: string[]; riskClass: RiskClass }

const PHASES: Phase[] = [
  {
    title: 'Phase 1 — Fundament & App-Shell',
    goal: `Scaffold ${APP}, a professional AI content-generation SaaS. Build the Next.js 15 + TypeScript + Tailwind foundation: a polished dark-theme app shell (sidebar: Studio, History, Templates, Billing, Settings; top bar) and a marketing landing page. Set up Vitest.`,
    context: `${SHARED}\nPHASE 1 of 4 — foundation ONLY, no features yet. A scoped starter scaffold may have been copied in (read SCAFFOLD.md if present and ADAPT it). Deliver: working Next.js 15 app that builds; Tailwind; app shell layout; landing page at / (hero + features + CTA); empty Studio page at /studio; Vitest with 1 passing test; README.`,
    dod: ['npm run build green', 'TypeScript 0 errors', 'App shell with sidebar (Studio, History, Templates, Billing, Settings)', 'Landing page at / (hero, features, CTA)', 'Vitest set up, ≥1 passing test'],
    riskClass: 'B',
  },
  {
    title: 'Phase 2 — Datenmodell, Prisma & Auth',
    goal: `Add the data layer and auth to ${APP}: Prisma schema (User, Template, Generation, UsageLedger), seed data, and credentials login with a signed session cookie.`,
    context: `${SHARED}\nPHASE 2 of 4 — build on the EXISTING Phase 1 code, do not re-scaffold.\nDeliver: Prisma models — User; Template (name, description, promptBody, ownerId); Generation (prompt, output, templateId?, model, tokensUsed, userId, createdAt); UsageLedger (userId, delta, reason, createdAt) for credits. Migration + seed (demo user, a few templates, sample generations, starting credit balance). Credentials auth: login page, hashed passwords (no plaintext), session cookie, route protection for /studio /history /templates /billing /settings, logout.`,
    dod: ['Prisma: User, Template, Generation, UsageLedger + migration', 'Seed: demo user, templates, sample generations, credit balance', 'Credentials login + hashed passwords + session + protected routes + logout', 'npm run build green, TypeScript 0 errors, tests pass'],
    riskClass: 'B',
  },
  {
    title: 'Phase 3 — KI-Kern: Router, Guardrails & Studio',
    goal: `Build the AI core of ${APP}: a provider-agnostic AI router (mock default, cloud + local optional), guardrails (cost estimate, rate limit, PII scrub, prompt-injection check), and the Studio generate flow (prompt + optional template → generated content, saved to history and charged to the usage ledger).`,
    context: `${SHARED}\nPHASE 3 of 4 — build on EXISTING Phase 1+2 code.\nReuse the ForgePilot ai-routing + ai-guardrails building blocks (absolute paths in the Reusable Building Blocks section) — read and adapt them. Deliver: src/lib/ai with a provider interface, a MockProvider (default, deterministic), and Anthropic/Ollama providers selected by AI_MODE; guardrails (cost/rate/PII/injection) wrapping every call; a Studio page where the user picks a template or writes a prompt, clicks Generate, and gets output; each generation is persisted (Generation row) and deducts credits (UsageLedger); a History page listing past generations; Templates CRUD. Cover the router + guardrails + generate logic with Vitest.`,
    dod: ['AI router: MockProvider default + cloud/local via AI_MODE, provider interface', 'Guardrails: cost + rate limit + PII scrub + injection check wrap every AI call', 'Studio: prompt/template → Generate → output, persisted + credits deducted', 'History list + Templates CRUD', 'Vitest for router/guardrails/generate; npm run build green; 0 TS errors'],
    riskClass: 'B',
  },
  {
    title: 'Phase 4 — Billing, Usage-Dashboard & Politur',
    goal: `Finish ${APP} as a professional SaaS: usage-based billing (credit plans Free/Pro/Team, mock checkout, balance + top-up), a Settings area (AI provider/model config, profile), a usage dashboard (credits used, generations over time, by template), empty/loading/error states, accessibility, and documentation.`,
    context: `${SHARED}\nPHASE 4 of 4 (final) — build on EXISTING Phase 1-3 code.\nDeliver: Billing page with credit plans (Free/Pro/Team), current balance, mock "Upgrade"/"Top up" that adds credits via UsageLedger; Settings (AI mode/model, profile, theme); a Dashboard with real usage stats (credits used, generations count, by template/day); polished empty/loading/error states + a11y across pages; DOCS.md (architecture) + FUNCTIONAL_TESTS.md. Ensure the full app builds, all tests pass, and the mock AI works end-to-end with no secrets.`,
    dod: ['Billing: Free/Pro/Team credit plans + balance + mock top-up via UsageLedger', 'Settings: AI mode/model + profile persisted', 'Usage dashboard with real stats (credits, generations, by template)', 'Empty/loading/error states + a11y; DOCS.md + FUNCTIONAL_TESTS.md', 'Full app: npm run build green, all tests pass, mock AI works without secrets'],
    riskClass: 'B',
  },
]

async function main() {
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const now = new Date().toISOString()
  const ids = PHASES.map(() => randomUUID())
  const tag = `aistudio-${Date.now()}`

  for (let i = 0; i < PHASES.length; i++) {
    const phase = PHASES[i]!
    await repo.create({
      id: ids[i]!,
      title: `[${i + 1}/${PHASES.length}] ${phase.title}`,
      status: i === 0 ? 'approved' : 'pending',
      executionRoute: 'local-agent',
      costEstimateUsd: BUDGET_PER_PHASE,
      chainNextId: ids[i + 1] ?? undefined,
      chainPosition: i,
      targetRepo: TARGET_REPO,
      worktreeAppType: 'nextjs',
      tags: [`build:${tag}`, `phase:${i + 1}`],
      contract: {
        id: randomUUID(),
        workItemId: tag,
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
    console.log(`Phase ${i + 1}: ${ids[i]}${ids[i + 1] ? ` → ${ids[i + 1]}` : ''}`) // eslint-disable-line no-console
  }
  console.log(`FIRST_DELEGATION_ID=${ids[0]}`) // eslint-disable-line no-console
}

main().catch(err => { console.error(err); process.exit(1) }) // eslint-disable-line no-console
