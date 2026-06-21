/**
 * Concept (blueprint) step of the guided Idea Studio.
 *
 * Produces a plain-language blueprint for a goal — overview, recommendations and
 * things to consider — that the user can iterate on via human-in-the-loop
 * feedback until it's watertight, before milestones/tasks are planned and built.
 *
 * AI-backed with tolerant parsing + a safe fallback so the wizard always advances.
 */
import { generateText } from '@/lib/ai/text-generation'

export interface Concept {
  /** A clear, plain-language description of what the app will be and do. */
  overview: string
  appType: string
  /** Concrete recommendations to make the product stronger. */
  recommendations: string[]
  /** Things to consider / decide (trade-offs, risks, scope questions). */
  considerations: string[]
}

const SYSTEM = [
  'You are a senior product architect writing a plain-language BLUEPRINT for a non-technical person.',
  'No jargon. Be concrete, honest, and concise.',
  'Return ONLY JSON: {"overview": string, "appType": string, "recommendations": string[], "considerations": string[]}.',
  'overview: 2-4 sentences describing what the app is and does.',
  'recommendations: 3-5 concrete ideas that make it stronger.',
  'considerations: 2-4 trade-offs/decisions/risks the user should be aware of.',
].join('\n')

export function parseConcept(raw: string): Concept | null {
  const text = raw.trim()
  let jsonText: string | null = text.startsWith('{') ? text : null
  if (!jsonText) {
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (fence?.[1]) jsonText = fence[1].trim()
    else {
      const s = text.indexOf('{'); const e = text.lastIndexOf('}')
      if (s !== -1 && e > s) jsonText = text.slice(s, e + 1)
    }
  }
  if (!jsonText) return null
  let parsed: unknown
  try { parsed = JSON.parse(jsonText) } catch { return null }
  if (typeof parsed !== 'object' || parsed === null) return null
  const r = parsed as Record<string, unknown>
  const overview = typeof r.overview === 'string' ? r.overview.trim() : ''
  if (!overview) return null
  const list = (v: unknown, max: number): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map(x => x.trim()).filter(Boolean).slice(0, max) : []
  return {
    overview: overview.slice(0, 1200),
    appType: typeof r.appType === 'string' && r.appType.trim() ? r.appType.trim().slice(0, 40) : 'web app',
    recommendations: list(r.recommendations, 6),
    considerations: list(r.considerations, 6),
  }
}

/**
 * Generate (or refine) the concept. Pass `feedback` + `previousOverview` to run
 * another human-in-the-loop iteration that incorporates the user's wishes.
 */
export async function generateConcept(options: {
  goal: string
  context?: string
  feedback?: string
  previousOverview?: string
  generate?: typeof generateText
}): Promise<Concept> {
  const gen = options.generate ?? generateText
  const prompt = [
    `Goal: ${options.goal}`,
    options.context ? `Context: ${options.context}` : '',
    options.previousOverview ? `Previous blueprint: ${options.previousOverview}` : '',
    options.feedback ? `The user wants these changes — incorporate them: ${options.feedback}` : '',
    'Write the blueprint as JSON.',
  ].filter(Boolean).join('\n')
  try {
    const result = await gen({ system: SYSTEM, prompt, maxTokens: 900, purpose: 'fast' })
    const parsed = parseConcept(result.text)
    if (parsed) return parsed
  } catch { /* fall through */ }
  return {
    overview: options.feedback ? `${options.goal} (mit Anpassung: ${options.feedback})` : options.goal,
    appType: 'web app',
    recommendations: [],
    considerations: [],
  }
}
