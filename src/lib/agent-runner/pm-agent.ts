import type { ProjectBrief } from '@/lib/models/project-brief'
import type { Milestone, WorkPackage } from '@/lib/models/milestone'
import type { Delegation } from '@/lib/models/delegation'

interface AnthropicResponse {
  content: Array<{ type: 'text'; text: string }>
  usage: { input_tokens: number; output_tokens: number }
}

export type PMPriority = 'critical' | 'high' | 'medium' | 'low'
export type PMRiskFlag = 'dependency_blocker' | 'scope_creep' | 'overdue' | 'no_owner' | 'budget_risk' | 'missing_dod'

export interface PMWorkPackageReview {
  workPackageId: string
  title: string
  recommendedPriority: PMPriority
  currentStatus: string
  flags: PMRiskFlag[]
  reasoning: string
  suggestedNextAction: 'delegate_now' | 'delegate_later' | 'needs_clarification' | 'block_dependency' | 'skip'
}

export interface PMNextDelegation {
  workPackageId: string
  title: string
  rationale: string
  estimatedHours: number
  riskClass: string
}

export interface PMAgentResult {
  summary: string
  overallHealth: 'green' | 'yellow' | 'red'
  reviews: PMWorkPackageReview[]
  nextDelegations: PMNextDelegation[]   // top 3-5 to start immediately
  blockers: string[]
  recommendations: string[]
  runAt: string
  tokenUsage: { promptTokens: number; completionTokens: number }
}

const SYSTEM_PROMPT = `You are an expert AI Project Manager. You analyze project portfolios and provide prioritized, actionable plans.

Your job:
1. Review all work packages across milestones
2. Identify risks, blockers, and dependencies
3. Recommend which work packages to delegate next (to AI agents)
4. Provide clear reasoning for all decisions

Respond ONLY with valid JSON matching this schema:
{
  "summary": "2-3 sentence executive summary of current project state",
  "overallHealth": "green" | "yellow" | "red",
  "reviews": [
    {
      "workPackageId": "string",
      "title": "string",
      "recommendedPriority": "critical"|"high"|"medium"|"low",
      "currentStatus": "string",
      "flags": [],
      "reasoning": "string",
      "suggestedNextAction": "delegate_now"|"delegate_later"|"needs_clarification"|"block_dependency"|"skip"
    }
  ],
  "nextDelegations": [
    {
      "workPackageId": "string",
      "title": "string",
      "rationale": "string",
      "estimatedHours": number,
      "riskClass": "A"|"B"|"C"
    }
  ],
  "blockers": ["string"],
  "recommendations": ["string"]
}`

function buildPMPrompt(
  briefs: ProjectBrief[],
  milestones: Milestone[],
  workPackages: WorkPackage[],
  delegations: Delegation[],
): string {
  const briefSummaries = briefs.map(b =>
    `- [${b.status}] ${b.title} (${b.scope} scope, ${b.requirements.filter(r => r.status === 'accepted').length} requirements accepted)`
  ).join('\n')

  const milestoneSummaries = milestones.map(m => {
    const wps = workPackages.filter(wp => wp.milestoneId === m.id)
    const done = wps.filter(wp => wp.status === 'done').length
    return `- [${m.status}] M: ${m.title} (${done}/${wps.length} WPs done, week ${m.targetWeek ?? '?'})`
  }).join('\n')

  const wpDetails = workPackages.map(wp => {
    const activeDelegation = delegations.find(d =>
      d.status === 'running' && (d.title?.includes(wp.title) || d.contract.goal?.includes(wp.title))
    )
    return {
      id: wp.id,
      title: wp.title,
      status: wp.status,
      priority: wp.priority,
      riskClass: wp.riskClass,
      estimatedHours: wp.estimatedHours,
      dependsOn: wp.dependsOn.length,
      dod: wp.definitionOfDone.length,
      hasActiveDelegation: !!activeDelegation,
      tags: wp.tags,
    }
  })

  const runningDelegations = delegations
    .filter(d => d.status === 'running')
    .map(d => `- [running] ${d.title || d.contract.goal.slice(0, 60)}`)
    .join('\n') || 'None running'

  const failedDelegations = delegations
    .filter(d => d.status === 'failed')
    .map(d => `- [FAILED] ${d.title || d.contract.goal.slice(0, 60)}: ${d.errorMessage ?? 'unknown error'}`)
    .join('\n') || 'None failed'

  return `Analyze this project portfolio and provide a prioritized action plan.

## Active Projects (${briefs.length})
${briefSummaries || 'No projects yet'}

## Milestones (${milestones.length})
${milestoneSummaries || 'No milestones generated yet'}

## Work Packages (${workPackages.length} total)
${JSON.stringify(wpDetails, null, 2)}

## Current Agent Activity
Running delegations:
${runningDelegations}

Failed delegations (need attention):
${failedDelegations}

Provide your analysis. Focus on:
1. Which 3-5 work packages should be delegated to AI agents RIGHT NOW
2. What is blocking progress
3. Risk flags that need human attention (Risk Class C items)
4. Overall project health

Output JSON matching the schema in your system prompt.`
}

function parseResult(raw: string): Omit<PMAgentResult, 'runAt' | 'tokenUsage'> | null {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  try {
    return JSON.parse(cleaned) as Omit<PMAgentResult, 'runAt' | 'tokenUsage'>
  } catch {
    return null
  }
}

export interface PMAgentOptions {
  apiKey: string
  model?: string
  fetcher?: typeof fetch
}

export async function runPMAgent(
  briefs: ProjectBrief[],
  milestones: Milestone[],
  workPackages: WorkPackage[],
  delegations: Delegation[],
  options: PMAgentOptions,
): Promise<PMAgentResult> {
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
      messages: [{ role: 'user', content: buildPMPrompt(briefs, milestones, workPackages, delegations) }],
    }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`Anthropic API ${res.status}: ${err.slice(0, 300)}`)
  }

  const data = await res.json() as AnthropicResponse
  const rawText = data.content.find(c => c.type === 'text')?.text ?? ''
  const parsed = parseResult(rawText)

  if (!parsed) throw new Error('Could not parse PM agent response as JSON')

  return {
    ...parsed,
    runAt: new Date().toISOString(),
    tokenUsage: {
      promptTokens: data.usage.input_tokens,
      completionTokens: data.usage.output_tokens,
    },
  }
}
