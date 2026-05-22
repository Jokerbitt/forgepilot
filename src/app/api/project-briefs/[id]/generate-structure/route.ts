export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { findProjectBriefById, updateProjectBrief } from '@/lib/project-briefs'
import type { Requirement, UseCase, Risk } from '@/lib/models/project-brief'
import { AIProviderConfigurationError, generateText, stripJsonCodeFence } from '@/lib/ai/text-generation'

interface RouteParams {
  params: Promise<{ id: string }>
}

const SYSTEM_PROMPT = `Du bist ein erfahrener Software-Architekt und Produktmanager.
Deine Aufgabe ist es, aus einem Projektsteckbrief eine vollständige Projektstruktur abzuleiten.

Regeln:
- Leite NUR ab, was aus dem Projektsteckbrief direkt folgt. Keine Erfindungen.
- Requirements aus Nutzersicht: "Der Nutzer kann...", "Das System muss..."
- MoSCoW-Priorisierung: maximal 40% 'must'.
- Use Cases: 3-5 Schritte im mainFlow, realistischer Actor.
- Risiken: ehrliche Einschätzung mit konkreter Mitigation.
- Annahmen: explizit und überprüfbar formulieren.
- Implementierungsrichtung: 3-5 Sätze, technisch konkret, kein Marketing.
- Antworte ausschließlich mit gültigem JSON ohne Markdown-Codeblocks.`


export async function POST(_request: Request, { params }: RouteParams) {
  const { id } = await params

  const brief = findProjectBriefById(id)
  if (!brief) {
    return NextResponse.json({ error: 'Project brief not found' }, { status: 404 })
  }

  const userPrompt = `Projektsteckbrief:
---
Titel: ${brief.title}
Rohidee: ${brief.rawIdea}
Problem: ${brief.problemStatement}
Ziel: ${brief.desiredOutcome}
Zielgruppe: ${brief.targetAudience}
Scope: ${brief.scope}
Constraints: ${brief.constraints.join(', ') || 'keine'}
---

Generiere:
- 5-8 Requirements (functional, non_functional, constraint oder assumption)
- 2-3 Use Cases
- 3-4 Risiken mit Mitigation
- 3-5 Annahmen (assumptions) als kurze Strings
- Eine Implementierungsrichtung (implementationDirection) als 4-6 Sätze

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
  "assumptions": ["Annahme 1", "Annahme 2"],
  "implementationDirection": "..."
}`

  try {
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
      assumptions: string[]
      implementationDirection: string
    }

    const now = Date.now()

    const requirements: Requirement[] = parsed.requirements.map((r, i) => ({
      id: `${id}-gen-req-${now}-${i}`,
      briefId: id,
      type: (r.type as Requirement['type']) ?? 'functional',
      title: r.title,
      description: r.description,
      priority: (r.priority as Requirement['priority']) ?? 'should',
      source: 'ai_proposed',
      findingIds: [],
      status: 'proposed',
    }))

    const useCases: UseCase[] = (parsed.useCases ?? []).map((uc, i) => ({
      id: `${id}-gen-uc-${now}-${i}`,
      briefId: id,
      title: uc.title,
      actor: uc.actor,
      trigger: uc.trigger,
      mainFlow: uc.mainFlow,
      requirementIds: [],
      status: 'proposed',
    }))

    const risks: Risk[] = (parsed.risks ?? []).map((r, i) => ({
      id: `${id}-gen-risk-${now}-${i}`,
      briefId: id,
      title: r.title,
      description: r.description,
      probability: (r.probability as Risk['probability']) ?? 'medium',
      impact: (r.impact as Risk['impact']) ?? 'medium',
      mitigationIdea: r.mitigationIdea,
      isOpenAssumption: r.isOpenAssumption ?? false,
      findingIds: [],
    }))

    const assumptions: string[] = Array.isArray(parsed.assumptions) ? parsed.assumptions : []
    const implementationDirection: string = parsed.implementationDirection ?? ''

    const updated = updateProjectBrief(id, {
      requirements,
      useCases,
      risks,
      assumptions,
      implementationDirection,
      status: 'in_review',
    })

    return NextResponse.json({
      requirements,
      useCases,
      risks,
      assumptions,
      implementationDirection,
      brief: updated,
      source: 'ai',
    })
  } catch (err) {
    if (err instanceof AIProviderConfigurationError) {
      return NextResponse.json(
        {
          error: 'no_ai_provider',
          message: 'Kein KI-Anbieter konfiguriert. Starte Ollama oder setze einen API Key.',
          settingsUrl: '/settings',
        },
        { status: 503 },
      )
    }

    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Generation failed: ${message}` }, { status: 500 })
  }
}
