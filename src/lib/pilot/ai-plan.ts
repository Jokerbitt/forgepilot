import { generateText, AIProviderConfigurationError } from '@/lib/ai/text-generation'

export interface ExecutionPlan {
  summary: string
  steps: string[]
  estimatedComplexity: 'low' | 'medium' | 'high'
  suggestedApproach: string
  provider: string
  model: string
  inputTokens?: number
  outputTokens?: number
}

interface PlanInput {
  title: string
  goal: string
  riskClass: string
  privacyMode: string
  definitionOfDone?: string[]
}

const SYSTEM_PROMPT = `You are ForgePilot, an AI workflow orchestrator.
Your task is to analyze a work item and create a concise execution plan.
Respond ONLY with valid JSON matching this schema:
{
  "summary": "one sentence description of the work",
  "steps": ["step1", "step2", "step3"],
  "estimatedComplexity": "low|medium|high",
  "suggestedApproach": "one paragraph with the recommended technical approach"
}
Keep steps short (max 10 words each), 3-5 steps maximum. Be concrete and actionable.`

function buildPrompt(input: PlanInput): string {
  const dod = input.definitionOfDone?.length
    ? `\nDefinition of Done: ${input.definitionOfDone.join(', ')}`
    : ''
  return `Work Item: ${input.title}
Goal: ${input.goal}
Risk Class: ${input.riskClass}
Privacy Mode: ${input.privacyMode}${dod}

Generate an execution plan for this work item.`
}

function parsePlan(raw: string): Omit<ExecutionPlan, 'provider' | 'model' | 'inputTokens' | 'outputTokens'> {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
  const parsed = JSON.parse(cleaned) as Partial<ExecutionPlan>
  return {
    summary: typeof parsed.summary === 'string' ? parsed.summary : 'No summary generated',
    steps: Array.isArray(parsed.steps) ? parsed.steps.filter(s => typeof s === 'string') : [],
    estimatedComplexity: ['low', 'medium', 'high'].includes(parsed.estimatedComplexity ?? '')
      ? (parsed.estimatedComplexity as ExecutionPlan['estimatedComplexity'])
      : 'medium',
    suggestedApproach: typeof parsed.suggestedApproach === 'string' ? parsed.suggestedApproach : '',
  }
}

export async function generateExecutionPlan(input: PlanInput): Promise<ExecutionPlan> {
  const result = await generateText({
    system: SYSTEM_PROMPT,
    prompt: buildPrompt(input),
    maxTokens: 400,
    purpose: 'fast',
  })

  const planData = parsePlan(result.text)

  return {
    ...planData,
    provider: result.provider,
    model: result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  }
}

/** Fallback plan used when AI is unavailable (no API key configured) */
export function buildFallbackPlan(input: PlanInput): ExecutionPlan {
  return {
    summary: `Implement: ${input.title}`,
    steps: [
      'Review existing code and tests',
      'Implement the required changes',
      'Write or update tests',
      'Create PR and request review',
    ],
    estimatedComplexity: input.riskClass === 'C' ? 'high' : input.riskClass === 'B' ? 'medium' : 'low',
    suggestedApproach: `Standard implementation approach for ${input.goal}. Follow project conventions and ensure tests pass before PR.`,
    provider: 'fallback',
    model: 'none',
  }
}
