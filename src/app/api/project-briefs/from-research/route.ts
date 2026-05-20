export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { getResearchDocument } from '@/lib/knowledge/research-store'
import { saveProjectBrief } from '@/lib/project-briefs'
import { readStoredApiKeys } from '@/lib/connectors/config'
import { generateText, stripJsonCodeFence, AIProviderConfigurationError } from '@/lib/ai/text-generation'
import type { ProjectBrief } from '@/lib/models/project-brief'

const SYSTEM_PROMPT = `You are a product manager who turns research documents into structured project briefs.

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

export async function POST(req: Request) {
  const body = await req.json() as { researchId: string }

  if (!body.researchId?.trim()) {
    return NextResponse.json({ error: 'researchId is required' }, { status: 400 })
  }

  const research = getResearchDocument(body.researchId)
  if (!research) {
    return NextResponse.json({ error: 'Research document not found' }, { status: 404 })
  }
  if (research.status !== 'completed') {
    return NextResponse.json({ error: 'Research must be completed before creating a brief' }, { status: 422 })
  }

  const storedKeys = readStoredApiKeys()
  if (!storedKeys.ANTHROPIC_API_KEY?.trim()) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY nicht konfiguriert' }, { status: 422 })
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

  try {
    const result = await generateText({
      system: SYSTEM_PROMPT,
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

    const now = new Date().toISOString()
    const brief: ProjectBrief = {
      id: nanoid(10),
      title: parsed.title,
      status: 'draft',
      rawIdea: `Aus Recherche erstellt: "${research.topic}"`,
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
      createdAt: now,
      updatedAt: now,
    }

    saveProjectBrief(brief)

    return NextResponse.json({ briefId: brief.id, brief })
  } catch (err) {
    if (err instanceof AIProviderConfigurationError) {
      return NextResponse.json({ error: err.message }, { status: 422 })
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
