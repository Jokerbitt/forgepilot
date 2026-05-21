export const dynamic = 'force-dynamic'

/**
 * POST /api/idea/refine
 *
 * Two-phase idea refinement endpoint (M136):
 *   Phase 1: { idea } → { questions: string[] }            — AI generates 3-5 clarifying questions
 *   Phase 2: { idea, answers } → { brief: RefinedBriefDraft } — AI synthesises enriched brief
 */

import { NextRequest, NextResponse } from 'next/server'
import { parseBody } from '@/lib/validation/api'
import { z } from 'zod'
import { generateText, stripJsonCodeFence, AIProviderConfigurationError } from '@/lib/ai/text-generation'
import { apiLogger } from '@/lib/logger'

// ── Zod schemas ─────────────────────────────────────────────────────────────
const Phase1Schema = z.object({
  idea: z.string().min(10, 'idea must be at least 10 characters'),
  answers: z.undefined().optional(),
})

const Phase2Schema = z.object({
  idea: z.string().min(10),
  answers: z.array(
    z.object({
      question: z.string(),
      answer: z.string(),
    })
  ).min(1),
})

const CombinedSchema = z.union([Phase1Schema, Phase2Schema])

export interface RefinedBriefDraft {
  title: string
  problemStatement: string
  desiredOutcome: string
  targetAudience: string
  nonGoals: string[]
  successCriteria: string[]
  technicalConstraints: string
  scope: 'minimal' | 'standard' | 'full'
}

// ── Phase 1: Generate clarifying questions ───────────────────────────────────
const QUESTIONS_SYSTEM = `You are a senior product manager helping a developer clarify their idea before writing a project brief.
Generate exactly 4 focused, open-ended clarifying questions that will help produce a better project brief.
Each question should uncover a different dimension: target user, technical constraints, success criteria, or scope limits.
Respond ONLY with a JSON array of 4 strings. No markdown, no explanation.`

async function generateClarifyingQuestions(idea: string): Promise<string[]> {
  const result = await generateText({
    maxTokens: 512,
    system: QUESTIONS_SYSTEM,
    prompt: `Raw idea: "${idea}"\n\nGenerate 4 clarifying questions as a JSON array.`,
    purpose: 'fast',
  })
  const cleaned = stripJsonCodeFence(result.text)
  const parsed = JSON.parse(cleaned) as string[]
  if (!Array.isArray(parsed)) throw new Error('AI returned non-array for questions')
  return parsed.slice(0, 5)
}

// ── Phase 2: Synthesise enriched brief ───────────────────────────────────────
const BRIEF_SYSTEM = `You are a senior product manager creating a structured project brief.
Given an idea and answered clarifying questions, produce a comprehensive brief.
Respond ONLY with valid JSON — no markdown code fences, no explanation.`

async function synthesiseBrief(idea: string, answers: Array<{ question: string; answer: string }>): Promise<RefinedBriefDraft> {
  const qaText = answers.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n')
  const prompt = `Original idea: "${idea}"

Clarifying Q&A:
${qaText}

Produce this JSON object:
{
  "title": "concise project name (max 60 chars)",
  "problemStatement": "the specific problem being solved (1-2 sentences)",
  "desiredOutcome": "what changes when the problem is solved (1-2 sentences)",
  "targetAudience": "who this is for (1 sentence)",
  "nonGoals": ["non-goal 1", "non-goal 2"],
  "successCriteria": ["measurable criterion 1", "criterion 2", "criterion 3"],
  "technicalConstraints": "any technical constraints mentioned (1 sentence or empty string)",
  "scope": "minimal" | "standard" | "full"
}`

  const result = await generateText({
    maxTokens: 1024,
    system: BRIEF_SYSTEM,
    prompt,
    purpose: 'fast',
  })
  const cleaned = stripJsonCodeFence(result.text)
  const parsed = JSON.parse(cleaned) as RefinedBriefDraft
  if (!parsed.title || !parsed.problemStatement) throw new Error('Brief missing required fields')
  return parsed
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await parseBody(request, CombinedSchema)
  if (body instanceof NextResponse) return body

  try {
    // Phase 1 — no answers provided → return questions
    if (!('answers' in body) || !body.answers) {
      const questions = await generateClarifyingQuestions(body.idea)
      return NextResponse.json({ phase: 'questions', questions })
    }

    // Phase 2 — answers provided → return enriched brief
    const brief = await synthesiseBrief(body.idea, body.answers)
    return NextResponse.json({ phase: 'brief', brief })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    apiLogger.error({ event: 'idea.refine.error', err }, `Idea refinement failed: ${message}`)
    if (err instanceof AIProviderConfigurationError) {
      return NextResponse.json({ error: message }, { status: 503 })
    }
    return NextResponse.json({ error: `Refinement failed: ${message}` }, { status: 500 })
  }
}
