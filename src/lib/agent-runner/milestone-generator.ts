import type { ProjectBrief } from '@/lib/models/project-brief'
import type { ResearchDocument } from '@/lib/models/research'
import type { MilestoneGenerationResult } from '@/lib/models/milestone'

interface AnthropicResponse {
  content: Array<{ type: 'text'; text: string }>
  usage: { input_tokens: number; output_tokens: number }
}

export interface MilestoneGeneratorOptions {
  apiKey: string
  model?: string
  fetcher?: typeof fetch
}

const SYSTEM_PROMPT = `You are an expert software project manager and agile coach. You decompose project briefs into actionable milestones and work packages that AI agents can execute.

Rules:
- Milestones are major deliverables (3-6 per project), each 1-3 weeks of work
- Work packages are concrete, delegatable units (2-6 per milestone), each 2-16 hours
- Definition of Done must be specific and verifiable, not vague
- Risk class: A = additive/safe, B = modifies existing, C = risky/needs human review
- Priority: critical > high > medium > low
- Dependencies: reference workPackage titles (will be resolved to IDs later)
- Respond ONLY with valid JSON matching the schema below. No markdown fences, no extra text.

Schema:
{
  "milestones": [
    {
      "title": "string",
      "description": "string",
      "goal": "string — what success looks like",
      "targetWeek": number,
      "status": "planned"
    }
  ],
  "workPackages": [
    {
      "milestoneIndex": number,
      "title": "string",
      "description": "string",
      "definitionOfDone": ["string", ...],
      "riskClass": "A" | "B" | "C",
      "priority": "critical" | "high" | "medium" | "low",
      "estimatedHours": number,
      "dependsOn": [],
      "status": "backlog",
      "tags": ["string", ...]
    }
  ]
}`

function buildPrompt(brief: ProjectBrief, research?: ResearchDocument | null): string {
  const requirements = brief.requirements
    .filter(r => r.status !== 'rejected')
    .map(r => `- [${r.priority.toUpperCase()}] ${r.title}: ${r.description}`)
    .join('\n') || 'Keine Requirements generiert'

  const researchContext = research?.keyFindings?.length
    ? `\n## Research-Erkenntnisse (wissenschaftlich belegt)\n${research.keyFindings.map(f => `- ${f}`).join('\n')}\n`
    : ''

  const risks = brief.risks.length
    ? `\n## Bekannte Risiken\n${brief.risks.map(r => `- [${r.probability}/${r.impact}] ${r.title}`).join('\n')}\n`
    : ''

  return `Create a complete project plan for this software project.

## Project Brief
**Title:** ${brief.title}
**Problem:** ${brief.problemStatement}
**Goal:** ${brief.desiredOutcome}
**Audience:** ${brief.targetAudience}
**Scope:** ${brief.scope}
**Constraints:** ${brief.constraints.join(', ') || 'none'}
**Non-Goals:** ${brief.nonGoals.join(', ') || 'none'}
${researchContext}
## Requirements
${requirements}
${risks}

Decompose this into milestones and work packages. Each work package must be:
1. Small enough for a single AI agent to complete (max 16 hours)
2. Have a clear, testable Definition of Done
3. Assigned the correct risk class (A=safe, B=modifies existing, C=human review needed)

Output JSON matching the schema in your system prompt.`
}

function parseResult(raw: string): MilestoneGenerationResult | null {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  try {
    return JSON.parse(cleaned) as MilestoneGenerationResult
  } catch {
    return null
  }
}

export async function generateMilestones(
  brief: ProjectBrief,
  options: MilestoneGeneratorOptions,
  research?: ResearchDocument | null,
): Promise<{ result: MilestoneGenerationResult; tokenUsage: { promptTokens: number; completionTokens: number } }> {
  const model = options.model ?? 'claude-sonnet-4-6'
  const fetcher = options.fetcher ?? fetch

  const res = await fetcher('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': options.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildPrompt(brief, research) }],
    }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`Anthropic API ${res.status}: ${err.slice(0, 300)}`)
  }

  const data = await res.json() as AnthropicResponse
  const rawText = data.content.find(c => c.type === 'text')?.text ?? ''
  const result = parseResult(rawText)

  if (!result) throw new Error('Could not parse milestone generation response as JSON')

  return {
    result,
    tokenUsage: {
      promptTokens: data.usage.input_tokens,
      completionTokens: data.usage.output_tokens,
    },
  }
}
