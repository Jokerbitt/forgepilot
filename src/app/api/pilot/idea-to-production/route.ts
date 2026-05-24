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
import type { IdeaIntakeInput, PersistenceStrategy, PlanningMode, TargetPlatform } from '@/lib/models/project-brief'
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

function platformLabel(platform: TargetPlatform): string {
  if (platform === 'webapp') return 'Webapp'
  if (platform === 'desktop') return 'Desktop App'
  if (platform === 'mobile') return 'Mobile App fuer iOS und Android'
  if (platform === 'cross_platform') return 'Cross-platform App fuer Web, Desktop und Mobile'
  return 'ForgePilot soll empfehlen'
}

function platformPromptGuidance(platform: TargetPlatform, customPlatformNote?: string): string {
  if (customPlatformNote?.trim()) {
    return `Nutzer moechte eine eigene Produktform beschreiben: ${customPlatformNote.trim()}. Leite daraus passende Architektur-, UX- und Deployment-Empfehlungen ab.`
  }
  if (platform === 'webapp') {
    return 'Plane primaer als Webapp: Browser-first, responsive, schnelle MVP-Auslieferung, spaeter optional PWA/Desktop/Mobile Wrapper.'
  }
  if (platform === 'desktop') {
    return 'Plane primaer als Desktop App: lokale Dateien, Offline-Faehigkeit, Systemintegration, Update-Mechanik und Tastatur-Workflows beachten.'
  }
  if (platform === 'mobile') {
    return 'Plane primaer als Mobile App fuer iOS und Android: Touch-first, kleine Screens, Offline/Push, App-Store-Verteilung und native Geraetefunktionen beachten.'
  }
  if (platform === 'cross_platform') {
    return 'Plane cross-platform: gemeinsamer Produktkern, priorisierte Oberflaeche fuer den MVP, klare Reihenfolge fuer Web/Desktop/Mobile.'
  }
  return 'ForgePilot soll empfehlen, ob Webapp, Desktop App, Mobile App oder Cross-platform sinnvoll ist. Begruende die Empfehlung anhand Nutzen, Geraet, Offline-Bedarf, Verteilung und Aufwand.'
}

function persistenceLabel(strategy: PersistenceStrategy): string {
  if (strategy === 'postgres') return 'PostgreSQL'
  if (strategy === 'sqlite') return 'SQLite'
  if (strategy === 'json_file') return 'JSON-Dateien'
  if (strategy === 'supabase') return 'Supabase / Managed Postgres'
  if (strategy === 'none') return 'Keine dauerhafte Datenhaltung'
  return 'ForgePilot soll empfehlen'
}

function persistencePromptGuidance(strategy: PersistenceStrategy): string {
  if (strategy === 'postgres') return 'Plane PostgreSQL als robuste Produktiv-Datenbank: Transaktionen, Queries, parallele Agenten, Audit-Logs und spaeterer SaaS-Ausbau.'
  if (strategy === 'sqlite') return 'Plane SQLite fuer lokale Single-User/Desktop/Offline-Nutzung mit einfacher Verteilung.'
  if (strategy === 'json_file') return 'Plane JSON nur fuer Prototyp, lokale Export/Import-Faehigkeit oder sehr kleine Single-User-Tools. Markiere Migrationsgrenzen klar.'
  if (strategy === 'supabase') return 'Plane Supabase/Managed Postgres fuer schnelle Webapp/SaaS-Entwicklung mit Auth, Realtime und weniger Infrastrukturaufwand.'
  if (strategy === 'none') return 'Plane keine persistente Datenhaltung, aber pruefe Export, Audit-Anforderungen und spaetere Migration.'
  return 'ForgePilot soll Datenhaltung empfehlen. Default: Postgres fuer produktive Apps, SQLite fuer lokale Desktop/Offline-Apps, JSON nur fuer Prototypen oder Export.'
}

function resolveTargetPlatform(idea: string, requested: TargetPlatform, customPlatformNote?: string): TargetPlatform {
  if (customPlatformNote?.trim()) return 'undecided'
  if (requested !== 'undecided') return requested

  const text = idea.toLowerCase()
  const hasMobile = /\b(mobile|ios|android|app store|push|touch|smartphone|handy)\b/.test(text)
  const hasDesktop = /\b(desktop|mac|macos|windows|linux|offline|dateien|filesystem|lokal)\b/.test(text)
  const hasWeb = /\b(webapp|web app|browser|saas|dashboard|portal|admin|team|teilen|url)\b/.test(text)

  if ((hasMobile && hasDesktop) || (hasMobile && hasWeb) || (hasDesktop && hasWeb)) return 'cross_platform'
  if (hasMobile) return 'mobile'
  if (hasDesktop) return 'desktop'
  return 'webapp'
}

function resolvePersistenceStrategy(
  idea: string,
  requested: PersistenceStrategy,
  resolvedPlatform: TargetPlatform,
): PersistenceStrategy {
  if (requested !== 'recommend') return requested

  const text = idea.toLowerCase()
  const needsAuditOrCollaboration = /\b(team|agenten|parallel|audit|logs|rechte|rollen|multi|saas|kunden|reports|suche|dashboard)\b/.test(text)
  const localOffline = /\b(desktop|offline|lokal|single-user|einzelner nutzer|dateien)\b/.test(text)
  const prototype = /\b(prototyp|demo|experiment|klein|einfach)\b/.test(text)

  if (needsAuditOrCollaboration || resolvedPlatform === 'webapp' || resolvedPlatform === 'cross_platform') return 'postgres'
  if (localOffline || resolvedPlatform === 'desktop') return 'sqlite'
  if (prototype) return 'json_file'
  return 'postgres'
}

async function expandIdea(
  idea: string,
  planningMode: PlanningMode,
  targetPlatform: TargetPlatform,
  persistenceStrategy: PersistenceStrategy,
  customPlatformNote?: string,
): Promise<IdeaIntakeInput> {
  const system = `Du bist ein erfahrener Product Manager.
Deine Aufgabe: Wandle eine rohe Idee in ein strukturiertes Projektsteckbrief-Format um.
Antworte AUSSCHLIESSLICH mit gültigem JSON, keine Erklärungen, keine Markdown-Blöcke.`

  const prompt = `Rohe Idee: "${idea}"
Gewaehlte Produktform: ${platformLabel(targetPlatform)}
Plattform-Hinweis: ${platformPromptGuidance(targetPlatform, customPlatformNote)}
Gewaehlte Datenhaltung: ${persistenceLabel(persistenceStrategy)}
Datenhaltungs-Hinweis: ${persistencePromptGuidance(persistenceStrategy)}

Generiere ein JSON-Objekt mit diesen Feldern:
{
  "title": "Kurzer, prägnanter Projekttitel (max 60 Zeichen)",
  "rawIdea": "Die originale Idee (unverändert)",
  "problemStatement": "Welches Problem wird gelöst? (1-2 Sätze)",
  "targetAudience": "Für wen ist das? (1 Satz)",
  "desiredOutcome": "Was ist das gewünschte Ergebnis? (1-2 Sätze)",
  "planningMode": "${planningMode}",
  "targetPlatform": "${targetPlatform}",
  "customPlatformNote": "${customPlatformNote?.trim() ?? ''}",
  "persistenceStrategy": "${persistenceStrategy}",
  "constraints": ["Constraint 1", "Constraint 2"],
  "scope": "minimal",
  "researchMode": "quick",
  "privacyMode": "local"
}`

  try {
    const result = await generateText({ system, prompt, maxTokens: 1200, purpose: 'fast' })
    const json = stripJsonCodeFence(result.text)
    const match = result.text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(json || (match?.[0] ?? '{}')) as IdeaIntakeInput
    return { ...parsed, planningMode, targetPlatform, customPlatformNote, persistenceStrategy }
  } catch {
    // Fallback: build a minimal IdeaIntakeInput from the raw idea
    const words = idea.split(' ').slice(0, 6).join(' ')
    return {
      title: words.charAt(0).toUpperCase() + words.slice(1),
      rawIdea: idea,
      problemStatement: idea,
      targetAudience: 'Produktteam und Anwender',
      desiredOutcome: `Implementierung von: ${idea}`,
      planningMode,
      targetPlatform,
      customPlatformNote,
      persistenceStrategy,
      constraints: [platformPromptGuidance(targetPlatform, customPlatformNote), persistencePromptGuidance(persistenceStrategy)],
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
  const planningMode = parsed.planningMode
  const customPlatformNote = parsed.customPlatformNote?.trim()
  const targetPlatform = resolveTargetPlatform(idea.trim(), parsed.targetPlatform, customPlatformNote)
  const persistenceStrategy = resolvePersistenceStrategy(idea.trim(), parsed.persistenceStrategy, targetPlatform)

  // Step 1: Expand idea → structured fields
  const intakeInput = await expandIdea(idea.trim(), planningMode, targetPlatform, persistenceStrategy, customPlatformNote)

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
  const delegationId = crypto.randomUUID()
  const delegation: Delegation = {
    id: delegationId,
    title: topItem.title,
    status: 'approved',
    executionRoute: 'runner',
    costEstimateUsd: 0,
    briefId: brief.id,
    createdAt: now,
    updatedAt: now,
    contract: {
      id: `contract-${delegationId}`,
      workItemId: topItem.id,
      goal: topItem.title,
      context: `Project: ${brief.title}. ${brief.problemStatement}\nProduktform: ${platformLabel(targetPlatform)}.\n${brief.platformGuidance ?? ''}\nDatenhaltung: ${persistenceLabel(persistenceStrategy)}.\n${brief.persistenceGuidance ?? ''}`,
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
    planningMode: brief.planningMode,
    targetPlatform: brief.targetPlatform,
    platformGuidance: brief.platformGuidance,
    persistenceStrategy: brief.persistenceStrategy,
    persistenceGuidance: brief.persistenceGuidance,
    workItemCount: newItems.length,
    topItem,
    delegation: createdDelegation,
    run,
    taskCount: tasks.length,
  }, { status: 201 })
}
