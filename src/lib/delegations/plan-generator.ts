/**
 * plan-generator.ts — M106 Plan Mode
 *
 * AI-powered implementation plan generator.
 * Breaks a feature goal into 3–6 independently executable phases,
 * each of which becomes a delegation in a chain.
 */

import fs from 'fs'
import path from 'path'
import { generateText, stripJsonCodeFence } from '@/lib/ai/text-generation'
import { buildCodebaseContext } from '@/lib/agent/codebase-context'

export interface PlanPhase {
  id: string
  title: string
  description: string
  filesToCreate: string[]
  filesToModify: string[]
  dodItems: string[]
  riskClass: 'A' | 'B' | 'C'
  estimatedTurns: number
  skillCategory?: 'api-route' | 'ui-component' | 'data-model' | 'test' | 'refactor' | 'infrastructure' | 'documentation'
}

export interface DelegationPlan {
  id: string
  overview: string
  goal: string
  context: string
  targetRepo: string
  phases: PlanPhase[]
  status: 'draft' | 'approved' | 'executing' | 'done'
  delegationIds?: string[]
  createdAt: string
  updatedAt: string
}

const PLANS_FILE = path.join(process.cwd(), 'config', 'delegation-plans.json')

function loadPlans(): DelegationPlan[] {
  try {
    if (!fs.existsSync(PLANS_FILE)) return []
    return JSON.parse(fs.readFileSync(PLANS_FILE, 'utf8')) as DelegationPlan[]
  } catch {
    return []
  }
}

function savePlans(plans: DelegationPlan[]): void {
  fs.writeFileSync(PLANS_FILE, JSON.stringify(plans, null, 2), 'utf8')
}

export function getPlan(id: string): DelegationPlan | undefined {
  return loadPlans().find(p => p.id === id)
}

export function updatePlan(id: string, updates: Partial<DelegationPlan>): DelegationPlan | undefined {
  const plans = loadPlans()
  const idx = plans.findIndex(p => p.id === id)
  if (idx === -1) return undefined
  plans[idx] = { ...plans[idx], ...updates, updatedAt: new Date().toISOString() }
  savePlans(plans)
  return plans[idx]
}

export function createPlan(plan: Omit<DelegationPlan, 'id' | 'createdAt' | 'updatedAt'>): DelegationPlan {
  const id = `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const now = new Date().toISOString()
  const newPlan: DelegationPlan = { id, ...plan, createdAt: now, updatedAt: now }
  const plans = loadPlans()
  plans.unshift(newPlan)
  savePlans(plans)
  return newPlan
}

const PLAN_SYSTEM_PROMPT = `You are a senior software architect. Given a feature goal and codebase context, create a detailed implementation plan with 3–6 phases.

Each phase must be:
- Independently executable by an AI agent in one Claude session
- Focused on one concern (data model, API, UI, tests, etc.)
- Specific about which files to create/modify
- Testable with clear acceptance criteria

Output ONLY valid JSON matching this exact schema — no markdown, no explanation:
{
  "overview": "1–2 sentence summary of the full plan",
  "phases": [
    {
      "id": "p1",
      "title": "Short phase name",
      "description": "What this phase implements",
      "filesToCreate": ["src/..."],
      "filesToModify": ["src/..."],
      "dodItems": ["Specific acceptance criterion"],
      "riskClass": "A" | "B" | "C",
      "estimatedTurns": 30,
      "skillCategory": "api-route" | "ui-component" | "data-model" | "test" | "refactor" | "infrastructure" | "documentation"
    }
  ]
}`

function buildPlanPrompt(goal: string, context: string, codebaseContext: string, feedback?: string): string {
  const feedbackBlock = feedback ? `\n## User Feedback on Previous Plan\n${feedback}\n` : ''
  return `## Goal\n${goal}\n\n## Context\n${context || 'No additional context provided.'}\n${feedbackBlock}\n## Codebase\n${codebaseContext}`
}

export async function generatePlan(
  goal: string,
  context: string,
  targetRepo: string,
  feedback?: string,
): Promise<{ overview: string; phases: PlanPhase[] }> {
  // Build codebase context for the target repo if it exists locally
  let codebaseContext = ''
  try {
    if (fs.existsSync(targetRepo)) {
      const ctx = buildCodebaseContext(targetRepo, goal)
      codebaseContext = [
        `Stack: ${ctx.stack}`,
        `File tree:\n${ctx.fileTree.slice(0, 2000)}`,
        ctx.relevantFiles && ctx.relevantFiles.length > 0
          ? `Relevant files:\n${ctx.relevantFiles.map(f => `- ${f.path}`).join('\n')}`
          : '',
      ].filter(Boolean).join('\n')
    }
  } catch { /* non-critical */ }

  const result = await generateText({
    system: PLAN_SYSTEM_PROMPT,
    prompt: buildPlanPrompt(goal, context, codebaseContext, feedback),
    maxTokens: 3000,
    purpose: 'coding',
  })

  const json = stripJsonCodeFence(result.text)
  const parsed = JSON.parse(json) as { overview: string; phases: PlanPhase[] }

  // Assign IDs if missing, normalize fields
  const phases: PlanPhase[] = (parsed.phases ?? []).map((p, i) => ({
    id: p.id ?? `p${i + 1}`,
    title: p.title ?? `Phase ${i + 1}`,
    description: p.description ?? '',
    filesToCreate: p.filesToCreate ?? [],
    filesToModify: p.filesToModify ?? [],
    dodItems: p.dodItems ?? [],
    riskClass: (p.riskClass ?? 'B') as 'A' | 'B' | 'C',
    estimatedTurns: p.estimatedTurns ?? 30,
    skillCategory: p.skillCategory,
  }))

  return { overview: parsed.overview ?? '', phases }
}
