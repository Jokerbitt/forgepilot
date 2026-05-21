export const dynamic = 'force-dynamic'
/**
 * POST /api/pilot/idea-to-production
 *
 * The "Idea Owner as Builder" pipeline.
 *
 * Input: { idea: string } — one natural language sentence or paragraph
 *
 * Pipeline:
 *   1. AI expands the idea into structured fields (title, problem, goal, audience)
 *   2. Build + save a Project Brief
 *   3. AI generates Requirements from the brief
 *   4. Top requirements become Work Items (saved to local-items.json)
 *   5. Create a Delegation from the top work item
 *   6. AI decomposes into atomic tasks → Orchestrated Run
 *
 * Returns: { briefId, briefTitle, workItemCount, topItem, delegation, run, taskCount }
 */

import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { buildProjectBrief, saveProjectBrief } from '@/lib/project-briefs'
import type { IdeaIntakeInput } from '@/lib/models/project-brief'
import type { WorkItem } from '@/lib/models/work-item'
import type { Delegation } from '@/lib/models/delegation'
import { decomposeWithAI } from '@/lib/agents/ai-decomposer'
import { createRun } from '@/lib/agents/orchestrated-run'
import { generateText, stripJsonCodeFence } from '@/lib/ai/text-generation'
import { appendIdeaHistory } from '@/lib/pilot/idea-history-store'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { IdeaToProductionSchema } from '@/lib/validation/schemas'

const LOCAL_ITEMS_FILE = path.join(process.cwd(), 'config', 'local-items.json')

// ─── File helpers ──────────────────────────────────────────────────────────

function readLocalItems(): WorkItem[] {
  try {
    if (!fs.existsSync(LOCAL_ITEMS_FILE)) return []
    return JSON.parse(fs.readFileSync(LOCAL_ITEMS_FILE, 'utf-8')) as WorkItem[]
  } catch { return [] }
}

function writeLocalItems(items: WorkItem[]): void {
  const dir = path.dirname(LOCAL_ITEMS_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = LOCAL_ITEMS_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(items, null, 2))
  fs.renameSync(tmp, LOCAL_ITEMS_FILE)
}

// ─── AI: Expand idea → IdeaIntakeInput ────────────────────────────────────

async function expandIdea(idea: string): Promise<IdeaIntakeInput> {
  const system = `Du bist ein erfahrener Product Manager.
Deine Aufgabe: Wandle eine rohe Idee in ein strukturiertes Projektsteckbrief-Format um.
Antworte AUSSCHLIESSLICH mit gültigem JSON, keine Erklärungen, keine Markdown-Blöcke.`

  const prompt = `Rohe Idee: "${idea}"

Generiere ein JSON-Objekt mit diesen Feldern:
{
  "title": "Kurzer, prägnanter Projekttitel (max 60 Zeichen)",
  "rawIdea": "Die originale Idee (unverändert)",
  "problemStatement": "Welches Problem wird gelöst? (1-2 Sätze)",
  "targetAudience": "Für wen ist das? (1 Satz)",
  "desiredOutcome": "Was ist das gewünschte Ergebnis? (1-2 Sätze)",
  "constraints": ["Constraint 1", "Constraint 2"],
  "scope": "minimal",
  "researchMode": "quick",
  "privacyMode": "local"
}`

  try {
    const result = await generateText({ system, prompt, maxTokens: 1200, purpose: 'fast' })
    const json = stripJsonCodeFence(result.text)
    const match = result.text.match(/\{[\s\S]*\}/)
    return JSON.parse(json || (match?.[0] ?? '{}')) as IdeaIntakeInput
  } catch {
    // Fallback: build a minimal IdeaIntakeInput from the raw idea
    const words = idea.split(' ').slice(0, 6).join(' ')
    return {
      title: words.charAt(0).toUpperCase() + words.slice(1),
      rawIdea: idea,
      problemStatement: idea,
      targetAudience: 'Produktteam und Anwender',
      desiredOutcome: `Implementierung von: ${idea}`,
      constraints: [],
      scope: 'minimal',
      researchMode: 'quick',
      privacyMode: 'local',
    }
  }
}

// ─── AI: Brief → Work Items ────────────────────────────────────────────────

async function generateWorkItems(brief: { title: string; problemStatement: string; desiredOutcome: string }, briefId: string): Promise<WorkItem[]> {
  const system = `Du bist ein erfahrener Tech Lead.
Teile ein Projekt in 3-5 konkrete, umsetzbare Aufgaben auf.
Antworte AUSSCHLIESSLICH mit gültigem JSON-Array, keine Erklärungen.`

  const prompt = `Projekt: "${brief.title}"
Problem: ${brief.problemStatement}
Ziel: ${brief.desiredOutcome}

Generiere ein JSON-Array mit 3-5 Work Items:
[{
  "title": "Konkrete Aufgabe (Imperativ, max 60 Zeichen)",
  "type": "feature",
  "priority": 1,
  "estimatedMinutes": 30,
  "risk": "A"
}]

Regeln:
- Aufgaben sollen in ca. 30-90 Minuten lösbar sein
- Technisch konkret und umsetzbar
- Nach Priorität sortiert (1 = höchste)
- risk ist immer "A" (niedriges Risiko für autonome Ausführung)`

  const now = new Date().toISOString()
  const fallback: WorkItem[] = [
    { id: crypto.randomUUID(), source: 'local', type: 'ticket', title: `Implementiere: ${brief.title}`, url: '', status: 'todo', priority: 1, blocked: false, risk: 'A', aiDelegable: true, estimatedMinutes: 60, projectId: briefId, createdAt: now, updatedAt: now },
  ]

  try {
    const result = await generateText({ system, prompt, maxTokens: 1500, purpose: 'fast' })
    const json = stripJsonCodeFence(result.text)
    const match = result.text.match(/\[[\s\S]*\]/)
    const parsed = JSON.parse(json || (match?.[0] ?? '[]')) as Array<{ title: string; type: string; priority: number; estimatedMinutes: number; risk: string }>

    return parsed.map(item => ({
      id: crypto.randomUUID(),
      source: 'local' as const,
      type: 'ticket' as const,
      title: item.title,
      url: '',
      status: 'todo' as const,
      priority: (item.priority ?? 1) as 0 | 1 | 2 | 3 | 4,
      blocked: false,
      risk: (item.risk as WorkItem['risk']) ?? 'A',
      aiDelegable: true,
      estimatedMinutes: item.estimatedMinutes ?? 45,
      projectId: briefId,
      createdAt: now,
      updatedAt: now,
    }))
  } catch {
    return fallback
  }
}

// ─── Main route ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const parsed = await parseBody(req, IdeaToProductionSchema)
  if (isValidationError(parsed)) return parsed

  const idea = parsed.idea

  // Step 1: Expand idea → structured fields
  const intakeInput = await expandIdea(idea.trim())

  // Step 2: Build + save Project Brief
  const brief = buildProjectBrief(intakeInput)
  saveProjectBrief(brief)

  // Step 3: Generate Work Items from brief
  const newItems = await generateWorkItems(brief, brief.id)

  // Step 4: Merge with existing local items (prepend new ones)
  const existingItems = readLocalItems()
  writeLocalItems([...newItems, ...existingItems])

  // Step 5: Pick top item (priority 1)
  const topItem = newItems[0]

  // Step 6: Create Delegation
  const now = new Date().toISOString()
  const delegation: Delegation = {
    id: `del-idea-${Date.now()}`,
    title: topItem.title,
    status: 'approved',
    executionRoute: 'runner',
    costEstimateUsd: 0,
    createdAt: now,
    updatedAt: now,
    contract: {
      id: `contract-idea-${Date.now()}`,
      workItemId: topItem.id,
      goal: topItem.title,
      context: `Project: ${brief.title}. ${brief.problemStatement}`,
      definitionOfDone: [`${topItem.title} is implemented`, 'Tests pass', 'No TypeScript errors'],
      riskClass: topItem.risk,
      maxBudgetUsd: 0,
      allowedTools: [],
      branchStrategy: 'feature',
      requiresApproval: false,
      privacyMode: 'local',
      createdAt: now,
    },
  }

  const delegationRepo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const createdDelegation = await delegationRepo.create(delegation)

  // Step 7: Decompose → Orchestrated Run
  const tasks = await decomposeWithAI(createdDelegation.contract.goal, brief.problemStatement)
  const run = createRun(createdDelegation.id, createdDelegation.title, createdDelegation.contract.goal, tasks)

  // Step 8: Append to Idea History
  appendIdeaHistory({
    id: crypto.randomUUID(),
    idea: idea.trim(),
    briefId: brief.id,
    briefTitle: brief.title,
    runId: run.id,
    workItemCount: newItems.length,
    taskCount: tasks.length,
    status: 'building',
    createdAt: now,
  })

  return NextResponse.json({
    briefId: brief.id,
    briefTitle: brief.title,
    workItemCount: newItems.length,
    topItem,
    delegation: createdDelegation,
    run,
    taskCount: tasks.length,
  }, { status: 201 })
}
