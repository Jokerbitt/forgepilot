/**
 * plan-generator.ts — AI-driven multi-phase implementation plan for large app builds.
 *
 * Generates a structured JSON plan (3–6 phases) from a user's goal description.
 * Each phase is independently executable by an AI agent in one Claude session.
 */

import { generateText } from '@/lib/ai/text-generation'
import { readKnowledgeCards } from '@/lib/knowledge/knowledge-card'
import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import type { RiskClass } from '@/lib/models/work-item'

const PLANS_FILE = path.join(process.cwd(), 'config', 'delegation-plans.json')

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlanPhase {
  id: string
  title: string
  description: string
  filesToCreate: string[]
  filesToModify: string[]
  dodItems: string[]
  riskClass: RiskClass
  estimatedTurns: number
  /** Filled after execute() — links to the created delegation */
  delegationId?: string
}

export interface DelegationPlan {
  id: string
  goal: string
  context: string
  targetRepo?: string
  overview: string
  phases: PlanPhase[]
  maxPhases: number
  createdAt: string
  updatedAt: string
  status: 'draft' | 'executing' | 'executed'
}

// ─── Persistence ──────────────────────────────────────────────────────────────

function readPlans(): DelegationPlan[] {
  try {
    if (!fs.existsSync(PLANS_FILE)) return []
    return JSON.parse(fs.readFileSync(PLANS_FILE, 'utf-8')) as DelegationPlan[]
  } catch {
    return []
  }
}

function writePlans(plans: DelegationPlan[]): void {
  const tmp = `${PLANS_FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(plans, null, 2))
  fs.renameSync(tmp, PLANS_FILE)
}

export function savePlan(plan: DelegationPlan): void {
  const plans = readPlans()
  const idx = plans.findIndex(p => p.id === plan.id)
  if (idx >= 0) plans[idx] = plan
  else plans.push(plan)
  // Keep latest 50 plans
  const sorted = plans.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50)
  writePlans(sorted)
}

export function getPlan(id: string): DelegationPlan | null {
  return readPlans().find(p => p.id === id) ?? null
}

export function listPlans(): DelegationPlan[] {
  return readPlans().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

// ─── Plan Generation ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior software architect helping an AI workflow system plan large feature builds.

Given a feature goal and optional context, create a detailed implementation plan with 3–6 phases.
Each phase must be:
- Independently executable by an AI coding agent in one session (30–80 turns)
- Testable at its end (TypeScript / tests must pass after the phase)
- Clearly scoped (specific files, not vague "update backend")

Risk classes:
- A: pure additions (new files, new API routes, new components) — safe to auto-run
- B: modifications to existing code — needs review before merge
- C: schema changes, auth, payments, security — requires human approval

Respond with ONLY valid JSON matching this schema (no markdown, no commentary):
{
  "overview": "string — 1-2 sentences describing the full feature",
  "phases": [
    {
      "id": "p1",
      "title": "string",
      "description": "string — what the agent should accomplish, 2-3 sentences",
      "filesToCreate": ["path/to/new/file.ts"],
      "filesToModify": ["path/to/existing/file.ts"],
      "dodItems": ["Specific verifiable done criterion", "Tests pass", "TypeScript 0 errors"],
      "riskClass": "A" | "B" | "C",
      "estimatedTurns": 30
    }
  ]
}`

interface RawPlanPhase {
  id?: string
  title?: string
  description?: string
  filesToCreate?: unknown[]
  filesToModify?: unknown[]
  dodItems?: unknown[]
  riskClass?: string
  estimatedTurns?: number
}

interface RawPlan {
  overview?: string
  phases?: RawPlanPhase[]
}

function buildFailureLessonsBlock(targetRepo?: string): string {
  try {
    const cards = readKnowledgeCards()
    const lessons = cards
      .filter(c => c.tags.includes('failure-lesson'))
      .filter(c => !targetRepo || c.tags.includes(targetRepo))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 3)
    if (lessons.length === 0) return ''
    const lines = lessons.map(c => `- ${c.title}: ${c.content.slice(0, 200)}`).join('\n')
    return `\n\nPast failure lessons from this codebase (avoid repeating these):\n${lines}`
  } catch {
    return ''
  }
}

function parsePlanResponse(raw: string, goal: string, context: string, targetRepo?: string, maxPhases = 6): DelegationPlan {
  // Strip any accidental markdown fences
  const json = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  let parsed: RawPlan
  try {
    parsed = JSON.parse(json) as RawPlan
  } catch {
    throw new Error(`Plan-Generierung gab kein valides JSON zurück: ${json.slice(0, 200)}`)
  }

  const phases: PlanPhase[] = (parsed.phases ?? []).slice(0, maxPhases).map((p, i) => ({
    id: p.id ?? `p${i + 1}`,
    title: String(p.title ?? `Phase ${i + 1}`),
    description: String(p.description ?? ''),
    filesToCreate: (p.filesToCreate ?? []).map(String),
    filesToModify: (p.filesToModify ?? []).map(String),
    dodItems: (p.dodItems ?? []).map(String),
    riskClass: (['A', 'B', 'C'].includes(String(p.riskClass)) ? p.riskClass : 'B') as RiskClass,
    estimatedTurns: typeof p.estimatedTurns === 'number' ? p.estimatedTurns : 40,
  }))

  const now = new Date().toISOString()
  return {
    id: randomUUID(),
    goal,
    context,
    targetRepo,
    overview: String(parsed.overview ?? goal),
    phases,
    maxPhases,
    createdAt: now,
    updatedAt: now,
    status: 'draft',
  }
}

export async function generatePlan(options: {
  goal: string
  context?: string
  targetRepo?: string
  maxPhases?: number
}): Promise<DelegationPlan> {
  const { goal, context = '', targetRepo, maxPhases = 6 } = options

  const lessonsBlock = buildFailureLessonsBlock(targetRepo)
  const prompt = [
    `Feature Goal: ${goal}`,
    context ? `Context: ${context}` : '',
    targetRepo ? `Target repository: ${targetRepo}` : '',
    lessonsBlock,
  ].filter(Boolean).join('\n')

  const result = await generateText({
    system: SYSTEM_PROMPT,
    prompt,
    maxTokens: 2000,
    purpose: 'fast',
  })

  const plan = parsePlanResponse(result.text, goal, context, targetRepo, maxPhases)
  savePlan(plan)
  return plan
}

export async function refinePlan(options: {
  planId: string
  feedback: string
}): Promise<DelegationPlan> {
  const { planId, feedback } = options
  const existing = getPlan(planId)
  if (!existing) throw new Error(`Plan ${planId} nicht gefunden`)

  const refinePrompt = [
    `Existing plan overview: ${existing.overview}`,
    `Current phases: ${existing.phases.map(p => `${p.id}: ${p.title}`).join(', ')}`,
    `\nUser feedback: ${feedback}`,
    `\nOriginal goal: ${existing.goal}`,
    existing.context ? `Context: ${existing.context}` : '',
    `\nPlease produce an updated plan incorporating the feedback. Keep phases that are already good, revise the ones mentioned in the feedback.`,
  ].filter(Boolean).join('\n')

  const result = await generateText({
    system: SYSTEM_PROMPT,
    prompt: refinePrompt,
    maxTokens: 2000,
    purpose: 'fast',
  })

  const updated = parsePlanResponse(result.text, existing.goal, existing.context, existing.targetRepo, existing.maxPhases)
  // Preserve the original plan's ID and creation time
  updated.id = existing.id
  updated.createdAt = existing.createdAt
  updated.updatedAt = new Date().toISOString()
  savePlan(updated)
  return updated
}
