export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { findProjectBriefById, updateProjectBrief } from '@/lib/project-briefs'
import type { Requirement, UseCase, Risk } from '@/lib/models/project-brief'
import { AIProviderConfigurationError, generateText, stripJsonCodeFence } from '@/lib/ai/text-generation'

interface RouteParams {
  params: { id: string }
}

const SYSTEM_PROMPT = `Du bist ein erfahrener Requirements Engineer und Produktmanager.
Deine Aufgabe ist es, aus einem Projektsteckbrief strukturierte Requirements, Use Cases und Risiken abzuleiten.

Regeln:
- Leite NUR ab, was aus dem Projektsteckbrief direkt folgt. Keine Erfindungen.
- Schreibe Requirements aus Nutzersicht: "Der Nutzer kann...", "Das System muss..."
- MoSCoW-Priorisierung: maximal 40% 'must'. Lieber 'should' als 'must'.
- Markiere Annahmen explizit als type 'assumption'.
- Use Cases: 3-5 Schritte im mainFlow, realistischer Actor.
- Risiken: ehrliche Einschaetzung, keine Panikmache.
- Antworte ausschliesslich mit gueltigem JSON ohne Markdown-Codeblocks.`

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const brief = findProjectBriefById(params.id)
    if (!brief) {
      return NextResponse.json({ error: 'Project brief not found' }, { status: 404 })
    }

    const model = brief.scope === 'full' ? 'claude-sonnet-4-5' : 'claude-haiku-4-5'
    const reqCount = brief.scope === 'minimal' ? 4 : brief.scope === 'full' ? 12 : 7
    const ucCount  = brief.scope === 'minimal' ? 0 : brief.scope === 'full' ? 4 : 2
    const riskCount = brief.scope === 'full' ? 4 : 2

    const userPrompt = `Projektsteckbrief:
---
Titel: ${brief.title}
Problem: ${brief.problemStatement}
Ziel: ${brief.desiredOutcome}
Zielgruppe: ${brief.targetAudience}
Scope: ${brief.scope}
Constraints: ${brief.constraints.join(', ') || 'keine'}
Nicht-Ziele: ${brief.nonGoals.join(', ') || 'keine'}
---

Generiere:
- ${reqCount} Requirements (functional, non_functional, constraint oder assumption)
- ${ucCount} Use Cases${ucCount === 0 ? ' (leer lassen)' : ''}
- ${riskCount} Risiken

Antwort-Format:
{
  "requirements": [
    {
      "title": "...",
      "description": "...",
      "type": "functional" | "non_functional" | "constraint" | "assumption",
      "priority": "must" | "should" | "could" | "wont"
    }
  ],
  "useCases": [
    {
      "title": "...",
      "actor": "...",
      "trigger": "...",
      "mainFlow": ["Schritt 1", "Schritt 2", "Schritt 3"]
    }
  ],
  "risks": [
    {
      "title": "...",
      "description": "...",
      "probability": "low" | "medium" | "high",
      "impact": "low" | "medium" | "high",
      "mitigationIdea": "...",
      "isOpenAssumption": true | false
    }
  ],
  "generationNotes": "Was hast du angenommen? (1-2 Saetze)"
}`

    const result = await generateText({
      maxTokens: 4096,
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      purpose: brief.scope === 'minimal' ? 'fast' : 'coding',
    })

    const cleaned = stripJsonCodeFence(result.text)
    let rawParsed: string
    try {
      JSON.parse(cleaned)
      rawParsed = cleaned
    } catch {
      const match = result.text.match(/\{[\s\S]*\}/)
      rawParsed = match ? match[0] : cleaned
    }
    const parsed = JSON.parse(rawParsed) as {
      requirements: Array<{ title: string; description: string; type: string; priority: string }>
      useCases: Array<{ title: string; actor: string; trigger: string; mainFlow: string[] }>
      risks: Array<{ title: string; description: string; probability: string; impact: string; mitigationIdea?: string; isOpenAssumption: boolean }>
      generationNotes: string
    }

    const now = Date.now()

    const requirements: Requirement[] = parsed.requirements.map((r, i) => ({
      id: `${params.id}-gen-req-${now}-${i}`,
      briefId: params.id,
      type: (r.type as Requirement['type']) ?? 'functional',
      title: r.title,
      description: r.description,
      priority: (r.priority as Requirement['priority']) ?? 'should',
      source: 'ai_proposed',
      findingIds: [],
      status: 'proposed',
    }))

    const useCases: UseCase[] = (parsed.useCases ?? []).map((uc, i) => ({
      id: `${params.id}-gen-uc-${now}-${i}`,
      briefId: params.id,
      title: uc.title,
      actor: uc.actor,
      trigger: uc.trigger,
      mainFlow: uc.mainFlow,
      requirementIds: [],
      status: 'proposed',
    }))

    const risks: Risk[] = parsed.risks.map((r, i) => ({
      id: `${params.id}-gen-risk-${now}-${i}`,
      briefId: params.id,
      title: r.title,
      description: r.description,
      probability: (r.probability as Risk['probability']) ?? 'medium',
      impact: (r.impact as Risk['impact']) ?? 'medium',
      mitigationIdea: r.mitigationIdea,
      isOpenAssumption: r.isOpenAssumption ?? false,
      findingIds: [],
    }))

    // Merge: keep accepted ones, replace proposed ones
    const existingAccepted = brief.requirements.filter(r => r.status === 'accepted')
    const existingAcceptedUC = brief.useCases.filter(uc => uc.status === 'accepted')
    const existingAcceptedRisks = brief.risks  // risks don't have status, keep all

    const mergedRequirements = [...existingAccepted, ...requirements]
    const mergedUseCases = [...existingAcceptedUC, ...useCases]
    const mergedRisks = [...existingAcceptedRisks, ...risks]

    const updated = updateProjectBrief(params.id, {
      requirements: mergedRequirements,
      useCases: mergedUseCases,
      risks: mergedRisks,
      status: 'in_review',
    })

    return NextResponse.json({
      requirements,
      useCases,
      risks,
      generationNotes: parsed.generationNotes ?? '',
      brief: updated,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (err instanceof AIProviderConfigurationError) {
      return NextResponse.json({ error: message }, { status: 503 })
    }
    return NextResponse.json({ error: `Generation failed: ${message}` }, { status: 500 })
  }
}
