import { NextResponse } from 'next/server'
import type { BriefScope } from '@/lib/models/project-brief'
import { AIProviderConfigurationError, generateText, stripJsonCodeFence } from '@/lib/ai/text-generation'

interface AISuggestRequest {
  rawIdea: string
  scope: BriefScope
}

interface AISuggestResponse {
  title: string
  problemStatement: string
  desiredOutcome: string
  targetAudience: string
  nonGoals: string[]
  confidence: 'high' | 'medium' | 'low'
}

const SYSTEM_PROMPT = `Du bist ein erfahrener Produktmanager. Deine Aufgabe ist es, aus einer rohen Projektidee
strukturierte Felder fuer einen Projektsteckbrief abzuleiten.

Regeln:
- Leite NUR ab, was aus der Idee direkt folgt. Keine Fantasie oder Erfindungen.
- Behalte den Originalton des Nutzers bei.
- Antworte ausschliesslich mit gueltigem JSON ohne Markdown-Codeblocks.
- nonGoals: 2-3 realistische Grenzen, die typischerweise fuer Erst-Versionen gelten.
- confidence: 'high' wenn die Idee klar ist, 'medium' wenn Luecken vorhanden, 'low' wenn sehr vage.`

export async function POST(request: Request) {
  try {
    const body = await request.json() as AISuggestRequest

    if (!body.rawIdea?.trim() || body.rawIdea.trim().length < 10) {
      return NextResponse.json({ error: 'rawIdea is required (min 10 chars)' }, { status: 400 })
    }

    const scopeHint = body.scope === 'minimal'
      ? 'Halte die Antworten sehr kurz und fokussiert.'
      : body.scope === 'full'
        ? 'Sei ausfuehrlich und bedenke auch Randaspekte.'
        : 'Halte die Antworten praezise und ausgewogen.'

    const userPrompt = `Projektidee des Nutzers:
---
${body.rawIdea.trim()}
---

${scopeHint}

Antworte mit folgendem JSON-Objekt:
{
  "title": "kurzer, praegnanter Projektname (max 60 Zeichen)",
  "problemStatement": "das konkrete Problem das geloest wird (1-2 Saetze)",
  "desiredOutcome": "was sich aendert wenn das Problem geloest ist (1-2 Saetze)",
  "targetAudience": "fuer wen ist das gedacht (1 Satz)",
  "nonGoals": ["Nicht-Ziel 1", "Nicht-Ziel 2", "Nicht-Ziel 3"],
  "confidence": "high" | "medium" | "low"
}`

    const result = await generateText({
      maxTokens: 1024,
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      purpose: 'fast',
    })

    const cleaned = stripJsonCodeFence(result.text)
    let parsed: AISuggestResponse
    try {
      parsed = JSON.parse(cleaned) as AISuggestResponse
    } catch {
      const match = result.text.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('KI-Antwort enthält kein gültiges JSON')
      parsed = JSON.parse(match[0]) as AISuggestResponse
    }

    // Validate required fields
    if (!parsed.title || !parsed.problemStatement || !parsed.desiredOutcome || !parsed.targetAudience) {
      return NextResponse.json({ error: 'AI response missing required fields' }, { status: 502 })
    }

    return NextResponse.json(parsed)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (err instanceof AIProviderConfigurationError) {
      return NextResponse.json({ error: message }, { status: 503 })
    }
    return NextResponse.json({ error: `AI suggest failed: ${message}` }, { status: 500 })
  }
}
