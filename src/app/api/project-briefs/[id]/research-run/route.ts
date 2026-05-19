import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import {
  findProjectBriefById,
  updateProjectBrief,
} from '@/lib/project-briefs'
import type { Requirement, Risk, ResearchRun, SourceRecord, Finding, BlueprintOutput } from '@/lib/models/project-brief'
import { AIProviderConfigurationError, generateText, stripJsonCodeFence } from '@/lib/ai/text-generation'

type RouteParams = { params: { id: string } }

// ── Types for Claude's JSON response ─────────────────────────────────────────

interface ClaudeResearchResult {
  summary: string
  findings: Array<{
    title: string
    claim: string
    confidence: 'high' | 'medium' | 'low'
    impact: 'high' | 'medium' | 'low'
    isOpenAssumption: boolean
    implication: string
  }>
  requirements: Array<{
    title: string
    description: string
    priority: 'must' | 'should' | 'could' | 'wont'
    type: 'functional' | 'non_functional' | 'constraint'
  }>
  risks: Array<{
    title: string
    description: string
    probability: 'low' | 'medium' | 'high'
    impact: 'low' | 'medium' | 'high'
    mitigationIdea: string
    isOpenAssumption: boolean
  }>
  generationNotes: string
}

// ── GET — POC preview (no AI, instant) ───────────────────────────────────────

export async function GET(_request: Request, { params }: RouteParams) {
  const brief = findProjectBriefById(params.id)
  if (!brief) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Return lightweight preview: just the ResearchBrief draft
  return NextResponse.json({
    briefId: brief.id,
    title: brief.researchBriefDraft.title,
    mode: brief.researchBriefDraft.mode,
    privacyMode: brief.researchBriefDraft.privacyMode,
    preferredExecutor: brief.researchBriefDraft.preferredExecutor,
    researchQuestions: brief.researchBriefDraft.researchQuestions,
    searchTerms: brief.researchBriefDraft.searchTerms,
    status: 'ready',
  })
}

// ── POST — real AI research run ───────────────────────────────────────────────

export async function POST(_request: Request, { params }: RouteParams) {
  const brief = findProjectBriefById(params.id)
  if (!brief) return NextResponse.json({ error: 'Brief nicht gefunden' }, { status: 404 })

  const runId = randomUUID()
  const now = new Date().toISOString()
  const model = brief.researchMode === 'deep' ? 'claude-sonnet-4-5' : 'claude-haiku-4-5'

  // Build prompt from brief data
  const researchQuestionsText = brief.researchBriefDraft.researchQuestions.length > 0
    ? brief.researchBriefDraft.researchQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')
    : [
        `Was sind die zentralen technischen Herausforderungen für: ${brief.desiredOutcome}?`,
        `Welche Best Practices gibt es für: ${brief.problemStatement}?`,
        `Welche Risiken und Constraints sind typisch für: ${brief.targetAudience}?`,
      ].join('\n')

  const constraintsText = brief.constraints.length > 0
    ? `\nConstraints: ${brief.constraints.join(', ')}`
    : ''
  const nonGoalsText = brief.nonGoals.length > 0
    ? `\nNicht-Ziele: ${brief.nonGoals.join(', ')}`
    : ''

  const systemPrompt = `Du bist ein erfahrener Projektanalyse-Assistent fuer ForgePilot AI Workflow OS.
Deine Aufgabe: Analysiere den Projektbrief und liefere strukturierte Forschungsergebnisse.
Antworte AUSSCHLIESSLICH mit einem validen JSON-Objekt ohne Markdown-Codeblocks oder Erklaerungen.

JSON-Schema:
{
  "summary": "<200-350 Woerter: Kernerkenntnisse, technische Einschaetzung, kritische Risiken>",
  "findings": [
    {
      "title": "<praegnanter Titel>",
      "claim": "<eine klare, ueberpruefbare Aussage>",
      "confidence": "high|medium|low",
      "impact": "high|medium|low",
      "isOpenAssumption": true|false,
      "implication": "<was das fuer das Projekt bedeutet>"
    }
  ],
  "requirements": [
    {
      "title": "<Requirements-Titel in einem Satz>",
      "description": "<Was genau wird benoetigt und warum>",
      "priority": "must|should|could|wont",
      "type": "functional|non_functional|constraint"
    }
  ],
  "risks": [
    {
      "title": "<Risikobezeichnung>",
      "description": "<Was koennte schiefgehen>",
      "probability": "low|medium|high",
      "impact": "low|medium|high",
      "mitigationIdea": "<Gegenmaßnahme>",
      "isOpenAssumption": true|false
    }
  ],
  "generationNotes": "<kurze Notiz zu getroffenen Annahmen, max 2 Saetze>"
}

Liefere 5-8 Findings, 4-8 Requirements, 2-4 Risiken. Antworte auf Deutsch.`

  const userPrompt = `Projektbrief:
Titel: ${brief.title}
Idee: ${brief.rawIdea}
Problem: ${brief.problemStatement}
Zielgruppe: ${brief.targetAudience}
Gewuenschtes Ergebnis: ${brief.desiredOutcome}${constraintsText}${nonGoalsText}
Scope: ${brief.scope} | Research-Modus: ${brief.researchMode}

Forschungsfragen:
${researchQuestionsText}`

  try {
    const generated = await generateText({
      // maxTokens: generous limit so JSON is never truncated by smaller models (Ollama etc.)
      maxTokens: brief.researchMode === 'deep' ? 4096 : 2048,
      system: systemPrompt,
      prompt: userPrompt,
      purpose: brief.researchMode === 'quick' ? 'fast' : 'coding',
    })

    const rawText = generated.text

    let result: ClaudeResearchResult
    try {
      // stripJsonCodeFence handles ```json ... ``` wrappers from Ollama/Groq
      const cleaned = stripJsonCodeFence(rawText)
      result = JSON.parse(cleaned) as ClaudeResearchResult
    } catch {
      // Robust fallback: extract first {...} block even if text is partially truncated
      const match = rawText.match(/\{[\s\S]*\}/)
      if (match) {
        try {
          result = JSON.parse(match[0]) as ClaudeResearchResult
        } catch {
          return NextResponse.json(
            { error: 'KI-Antwort konnte nicht verarbeitet werden', rawText },
            { status: 502 },
          )
        }
      } else {
        return NextResponse.json(
          { error: 'KI-Antwort konnte nicht verarbeitet werden', rawText },
          { status: 502 },
        )
      }
    }

    // ── Build ResearchRun from Claude's result ─────────────────────────────

    const source: SourceRecord = {
      id: `${runId}-src-ai`,
      runId,
      type: 'nas',
      title: `KI-Analyse: ${brief.title}`,
      urlOrPath: `project-brief://${brief.id}`,
      publisher: `${generated.provider} ${generated.model}`,
      retrievedAt: now,
      language: 'de',
      relevanceScore: 95,
      trustScore: 70,
      notes: `Generiert von ${generated.provider}/${generated.model}. ${result.generationNotes}`,
      snippets: [brief.rawIdea, brief.problemStatement].filter(Boolean),
    }

    const findings: Finding[] = result.findings.map((f, i) => ({
      id: `${runId}-finding-${i}`,
      runId,
      claim: f.claim,
      summary: f.implication,
      sourceIds: [source.id],
      confidence: f.confidence,
      isContradicted: false,
      contradictionIds: [],
      isOpenAssumption: f.isOpenAssumption,
      recommendationImpact: (f.impact === 'high' ? 'high' : f.impact === 'medium' ? 'medium' : 'low') as Finding['recommendationImpact'],
      tags: [f.title],
    }))

    const summaryOutput: BlueprintOutput = {
      id: `${runId}-output-summary`,
      runId,
      briefId: brief.id,
      type: 'findings_summary',
      title: `Forschungs-Summary: ${brief.title}`,
      content: result.summary,
      linkedFindingIds: findings.map(f => f.id),
      linkedRequirementIds: [],
      status: 'draft',
    }

    const tokensUsed = (generated.inputTokens ?? 0) + (generated.outputTokens ?? 0)

    const run: ResearchRun = {
      id: runId,
      briefId: brief.id,
      researchBriefId: `${brief.id}-research-brief`,
      title: `Research: ${brief.title}`,
      status: 'review_pending',
      executor: 'agent',
      mode: brief.researchBriefDraft.mode,
      privacyMode: brief.researchBriefDraft.privacyMode,
      startedAt: now,
      completedAt: now,
      sources: [source],
      findings,
      outputs: [summaryOutput],
      actualCostUsd: 0,
      openUncertainties: findings.filter(f => f.isOpenAssumption).map(f => f.claim),
      errorMessage: undefined,
    }

    // Attach token usage to source notes (for transparency)
    source.notes = `${source.notes ?? ''} | Tokens: ${tokensUsed}`

    // ── Enrich brief: merge new requirements and risks from research ──────

    const newReqs: Requirement[] = result.requirements.map((r, i) => ({
      id: `${runId}-req-${i}`,
      briefId: brief.id,
      type: r.type ?? 'functional',
      title: r.title,
      description: r.description,
      priority: r.priority,
      source: 'research' as const,
      findingIds: findings.map(f => f.id),
      status: 'proposed' as const,
    }))

    const newRisks: Risk[] = result.risks.map((r, i) => ({
      id: `${runId}-risk-${i}`,
      briefId: brief.id,
      title: r.title,
      description: r.description,
      probability: r.probability,
      impact: r.impact,
      mitigationIdea: r.mitigationIdea,
      isOpenAssumption: r.isOpenAssumption,
      findingIds: findings.map(f => f.id),
    }))

    // Keep existing accepted requirements, append research proposals
    const existingAccepted = brief.requirements.filter(r => r.status === 'accepted')
    const existingOtherNotDuplicate = brief.requirements.filter(
      r => r.status !== 'accepted' && !newReqs.some(n => n.title === r.title),
    )

    updateProjectBrief(brief.id, {
      requirements: [...existingAccepted, ...existingOtherNotDuplicate, ...newReqs],
      risks: [...brief.risks, ...newRisks],
      researchRunIds: [...(brief.researchRunIds ?? []), runId],
      lastResearchRun: run,
      status: brief.status === 'draft' ? 'in_review' : brief.status,
    })

    return NextResponse.json({
      run,
      generationNotes: result.generationNotes,
      newRequirementsCount: newReqs.length,
      newRisksCount: newRisks.length,
    }, { status: 201 })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    if (err instanceof AIProviderConfigurationError) {
      return NextResponse.json({ error: message }, { status: 503 })
    }
    return NextResponse.json({ error: `Research Run fehlgeschlagen: ${message}` }, { status: 500 })
  }
}
