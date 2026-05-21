export const dynamic = 'force-dynamic'

import { nanoid } from 'nanoid'
import { readStoredApiKeys } from '@/lib/connectors/config'
import { upsertResearchDocument, getResearchDocument } from '@/lib/knowledge/research-store'
import { runResearchAgent } from '@/lib/agent-runner/research-agent'
import { saveProjectBrief } from '@/lib/project-briefs'
import { generateText, stripJsonCodeFence } from '@/lib/ai/text-generation'
import { findProjectBriefById, updateProjectBrief } from '@/lib/project-briefs'
import { generateMilestones } from '@/lib/agent-runner/milestone-generator'
import { persistGeneratedPlan } from '@/lib/knowledge/milestone-store'
import { runPMAgent } from '@/lib/agent-runner/pm-agent'
import { readProjectBriefs } from '@/lib/project-briefs'
import { readMilestones, readWorkPackages } from '@/lib/knowledge/milestone-store'
import type { ResearchDocument } from '@/lib/models/research'
import type { ProjectBrief } from '@/lib/models/project-brief'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import { isValidationError } from '@/lib/validation/api'
import { FullCycleSchema } from '@/lib/validation/schemas'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FullCycleRequest {
  topic: string
  question?: string
}

interface SSEStep {
  step: number
  label: string
  status: 'running' | 'done' | 'error'
  id?: string
  researchId?: string
  briefId?: string
  health?: string
}

interface SSEDone {
  done: true
  briefId: string
  researchId: string
}

interface SSEError {
  error: string
  step: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function encodeSSE(data: SSEStep | SSEDone | SSEError): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

const BRIEF_FROM_RESEARCH_SYSTEM_PROMPT = `You are a product manager who turns research documents into structured project briefs.

Given a research document with key findings and citations, extract:
- A clear problem statement (what pain/opportunity does the research reveal?)
- The desired outcome (what should be built/achieved?)
- Target audience (who benefits?)
- Key constraints (technical, budget, time)
- Non-goals (what explicitly NOT to do)

Respond ONLY with valid JSON (no markdown fences):
{
  "title": "string",
  "problemStatement": "string (2-4 sentences)",
  "desiredOutcome": "string (2-3 sentences)",
  "targetAudience": "string",
  "constraints": ["string", ...],
  "nonGoals": ["string", ...]
}`

// ─── Main Handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const parsed = FullCycleSchema.safeParse(rawBody)
  if (!parsed.success) {
    const fields: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || '_root'
      if (!fields[key]) fields[key] = issue.message
    }
    return new Response(
      JSON.stringify({ error: 'Validation failed', fields }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const storedKeys = readStoredApiKeys()
  const apiKey = storedKeys.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY nicht konfiguriert. Bitte in den Einstellungen hinterlegen.' }),
      { status: 422, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const topic = parsed.data.topic
  const question = parsed.data.question || undefined

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: SSEStep | SSEDone | SSEError) => {
        controller.enqueue(encoder.encode(encodeSSE(data)))
      }

      let researchId: string | null = null
      let briefId: string | null = null

      try {
        // ── Step 1: Research ──────────────────────────────────────────────────
        send({ step: 1, label: 'Recherche läuft...', status: 'running' })

        const now = new Date().toISOString()
        const doc: ResearchDocument = {
          id: nanoid(10),
          topic,
          question,
          status: 'running',
          keyFindings: [],
          sections: [],
          citations: [],
          tags: [],
          createdAt: now,
          updatedAt: now,
          model: 'claude-opus-4-7',
        }
        upsertResearchDocument(doc)
        researchId = doc.id

        // Run research synchronously (full-cycle must wait for result)
        try {
          const result = await runResearchAgent(doc, { apiKey })
          const completed: ResearchDocument = {
            ...doc,
            ...result,
            status: 'completed',
            completedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
          upsertResearchDocument(completed)
        } catch (err) {
          const failed: ResearchDocument = {
            ...doc,
            status: 'failed',
            abstract: `Fehler: ${(err as Error).message.slice(0, 300)}`,
            updatedAt: new Date().toISOString(),
          }
          upsertResearchDocument(failed)
          send({ error: `Recherche fehlgeschlagen: ${(err as Error).message}`, step: 1 })
          controller.close()
          return
        }

        send({ step: 1, label: 'Recherche abgeschlossen', status: 'done', researchId })

        // ── Step 2: Create Brief from Research ────────────────────────────────
        send({ step: 2, label: 'Brief wird erstellt...', status: 'running' })

        const research = getResearchDocument(researchId)
        if (!research || research.status !== 'completed') {
          send({ error: 'Recherche-Dokument nicht gefunden oder nicht abgeschlossen', step: 2 })
          controller.close()
          return
        }

        const prompt = `Research Topic: ${research.topic}
${research.question ? `Research Question: ${research.question}\n` : ''}
Abstract: ${research.abstract ?? ''}

Key Findings:
${research.keyFindings.map(f => `- ${f}`).join('\n')}

Top Sources:
${research.citations.slice(0, 5).map(c => `- [${c.credibility}] ${c.title}: ${c.excerpt}`).join('\n')}

Tags: ${research.tags.join(', ')}

Create a project brief that turns these research findings into an actionable project.`

        let createdBriefId: string
        try {
          const result = await generateText({
            system: BRIEF_FROM_RESEARCH_SYSTEM_PROMPT,
            prompt,
            maxTokens: 1024,
            purpose: 'fast',
          })

          const parsed = JSON.parse(stripJsonCodeFence(result.text)) as {
            title: string
            problemStatement: string
            desiredOutcome: string
            targetAudience: string
            constraints: string[]
            nonGoals: string[]
          }

          const briefNow = new Date().toISOString()
          const brief: ProjectBrief = {
            id: nanoid(10),
            title: parsed.title,
            status: 'draft',
            rawIdea: `Aus Full-Cycle erstellt: "${research.topic}"`,
            problemStatement: parsed.problemStatement,
            desiredOutcome: parsed.desiredOutcome,
            targetAudience: parsed.targetAudience,
            constraints: parsed.constraints ?? [],
            nonGoals: parsed.nonGoals ?? [],
            scope: 'standard',
            researchMode: 'standard',
            privacyMode: 'local',
            requirements: [],
            useCases: [],
            risks: [],
            researchRunIds: [],
            researchBriefDraft: {
              title: `Research Brief: ${parsed.title}`,
              mode: 'standard',
              privacyMode: 'local',
              preferredExecutor: 'agent',
              researchQuestions: research.keyFindings.slice(0, 3).map(f => `Vertiefe: ${f}`),
              searchTerms: research.tags,
              preferredSourceTypes: ['web', 'docs'],
              excludeCriteria: [],
            },
            createdAt: briefNow,
            updatedAt: briefNow,
          }

          saveProjectBrief(brief)
          createdBriefId = brief.id
          briefId = brief.id
        } catch (err) {
          send({ error: `Brief-Erstellung fehlgeschlagen: ${(err as Error).message}`, step: 2 })
          controller.close()
          return
        }

        send({ step: 2, label: 'Brief erstellt', status: 'done', briefId: createdBriefId })

        // ── Step 3: Accept Brief ──────────────────────────────────────────────
        send({ step: 3, label: 'Brief wird akzeptiert...', status: 'running' })

        const updatedBrief = updateProjectBrief(createdBriefId, { status: 'accepted' })
        if (!updatedBrief) {
          send({ error: 'Brief konnte nicht akzeptiert werden', step: 3 })
          controller.close()
          return
        }

        send({ step: 3, label: 'Brief akzeptiert', status: 'done' })

        // ── Step 4: Generate Milestones ───────────────────────────────────────
        send({ step: 4, label: 'Meilensteine werden generiert...', status: 'running' })

        const briefForMilestones = findProjectBriefById(createdBriefId)
        if (!briefForMilestones) {
          send({ error: 'Brief nicht gefunden für Meilenstein-Generierung', step: 4 })
          controller.close()
          return
        }

        try {
          const { result } = await generateMilestones(
            briefForMilestones,
            { apiKey },
            research,
          )
          persistGeneratedPlan(createdBriefId, result.milestones, result.workPackages)
        } catch (err) {
          send({ error: `Meilenstein-Generierung fehlgeschlagen: ${(err as Error).message}`, step: 4 })
          controller.close()
          return
        }

        send({ step: 4, label: 'Meilensteine generiert', status: 'done' })

        // ── Step 5: PM Agent ──────────────────────────────────────────────────
        send({ step: 5, label: 'PM Agent analysiert...', status: 'running' })

        try {
          const briefs = readProjectBriefs().filter(b => b.status !== 'archived')
          const milestones = readMilestones()
          const workPackages = readWorkPackages()
          const delegationRepo = createDelegationRepository(SINGLE_TENANT_USER_ID)
          const delegations = await delegationRepo.listByStatus()

          const pmResult = await runPMAgent(briefs, milestones, workPackages, delegations, { apiKey })

          send({ step: 5, label: 'PM Agent abgeschlossen', status: 'done', health: pmResult.overallHealth })
        } catch (err) {
          send({ error: `PM Agent fehlgeschlagen: ${(err as Error).message}`, step: 5 })
          controller.close()
          return
        }

        // ── Done ──────────────────────────────────────────────────────────────
        send({ done: true, briefId: createdBriefId, researchId })
        controller.close()
      } catch (err) {
        const step = briefId ? 5 : researchId ? 3 : 1
        send({ error: `Unerwarteter Fehler: ${(err as Error).message}`, step })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
