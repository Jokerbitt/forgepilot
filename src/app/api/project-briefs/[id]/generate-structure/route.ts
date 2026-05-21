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

function buildFallbackStructure(
  id: string,
  title: string,
  problemStatement: string,
  desiredOutcome: string,
  targetAudience: string,
  constraints: string[],
): {
  requirements: Requirement[]
  useCases: UseCase[]
  risks: Risk[]
  assumptions: string[]
  implementationDirection: string
} {
  const now = Date.now()
  return {
    requirements: [
      {
        id: `${id}-gen-req-${now}-0`,
        briefId: id,
        type: 'functional',
        title: 'Kernfunktion realisieren',
        description: desiredOutcome || `Die Hauptfunktionalität für ${targetAudience} muss umgesetzt sein.`,
        priority: 'must',
        source: 'ai_proposed',
        findingIds: [],
        status: 'proposed',
      },
      {
        id: `${id}-gen-req-${now}-1`,
        briefId: id,
        type: 'non_functional',
        title: 'Benutzerfreundlichkeit',
        description: 'Das System muss intuitiv bedienbar sein und ohne Einarbeitung nutzbar sein.',
        priority: 'should',
        source: 'ai_proposed',
        findingIds: [],
        status: 'proposed',
      },
      ...constraints.map((constraint, i) => ({
        id: `${id}-gen-req-${now}-c${i}`,
        briefId: id,
        type: 'constraint' as const,
        title: `Constraint: ${constraint.slice(0, 40)}`,
        description: constraint,
        priority: 'must' as const,
        source: 'ai_proposed' as const,
        findingIds: [],
        status: 'proposed' as const,
      })),
    ],
    useCases: [
      {
        id: `${id}-gen-uc-${now}-0`,
        briefId: id,
        title: 'Hauptanwendungsfall',
        actor: targetAudience || 'Nutzer',
        trigger: 'Nutzer möchte das Kernproblem lösen',
        mainFlow: [
          'Nutzer öffnet die Anwendung',
          'Nutzer gibt die relevanten Informationen ein',
          'System verarbeitet die Anfrage',
          'Nutzer erhält das gewünschte Ergebnis',
        ],
        requirementIds: [],
        status: 'proposed',
      },
    ],
    risks: [
      {
        id: `${id}-gen-risk-${now}-0`,
        briefId: id,
        title: 'Unvalidierte Anforderungen',
        description: 'Die Anforderungen basieren auf initialen Annahmen und wurden noch nicht mit echten Nutzern validiert.',
        probability: 'medium',
        impact: 'high',
        mitigationIdea: 'Frühzeitiger Nutzertest mit Prototyp, bevor vollständige Implementierung beginnt.',
        isOpenAssumption: true,
        findingIds: [],
      },
      {
        id: `${id}-gen-risk-${now}-1`,
        briefId: id,
        title: 'Technische Komplexität unterschätzt',
        description: 'Die Umsetzung könnte technisch aufwendiger sein als initial eingeschätzt.',
        probability: 'medium',
        impact: 'medium',
        mitigationIdea: 'Technischen Proof-of-Concept für kritische Kernkomponenten erstellen.',
        isOpenAssumption: false,
        findingIds: [],
      },
    ],
    assumptions: [
      `${targetAudience || 'Die Zielgruppe'} hat Zugang zur benötigten Infrastruktur.`,
      'Das Problem ist relevant genug, um eine dedizierte Lösung zu rechtfertigen.',
      'Die technischen Constraints sind bekannt und vollständig.',
    ],
    implementationDirection: `Für "${title}" wird ein inkrementeller Ansatz empfohlen. ` +
      `Zunächst sollte ein MVP mit der Kernfunktion "${desiredOutcome?.slice(0, 80) || 'Hauptziel'}" umgesetzt werden. ` +
      `Die Constraints (${constraints.slice(0, 2).join(', ') || 'keine spezifischen'}) sind dabei von Beginn an zu berücksichtigen. ` +
      `Eine iterative Validierung mit ${targetAudience || 'der Zielgruppe'} sichert die Produktqualität.`,
  }
}

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
      // Fail-open: return structured placeholder when no API key configured
      const fallback = buildFallbackStructure(
        id,
        brief.title,
        brief.problemStatement,
        brief.desiredOutcome,
        brief.targetAudience,
        brief.constraints,
      )

      const updated = updateProjectBrief(id, {
        requirements: fallback.requirements,
        useCases: fallback.useCases,
        risks: fallback.risks,
        assumptions: fallback.assumptions,
        implementationDirection: fallback.implementationDirection,
        status: 'in_review',
      })

      return NextResponse.json({
        ...fallback,
        brief: updated,
        source: 'fallback',
      })
    }

    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Generation failed: ${message}` }, { status: 500 })
  }
}
