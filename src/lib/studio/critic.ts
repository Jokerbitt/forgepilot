/**
 * Critic pass for the Idea Studio blueprint. A second, skeptical LLM reviews the
 * concept and returns pros, cons, and things to watch out for — but ONLY when it
 * has something substantive to say, so the user gets real decision support, not
 * filler. Helps reach a watertight concept before milestones are planned + built.
 */
import { generateText } from '@/lib/ai/text-generation'

export interface Critique {
  pros: string[]
  cons: string[]
  considerations: string[]
  /** A one-line overall verdict (e.g. "Solide — buildbar"). */
  verdict: string
  /** True when the critic raised at least one pro/con/consideration. */
  hasFeedback: boolean
}

const SYSTEM = [
  'You are a sharp, skeptical senior software architect reviewing a product concept for a non-technical founder.',
  'Be honest and useful — surface real risks and trade-offs, not generic advice.',
  'If the concept is genuinely solid, say so and keep the lists short or empty.',
  'Return ONLY JSON: {"pros": string[], "cons": string[], "considerations": string[], "verdict": string}.',
  'pros/cons: concrete and specific. considerations: decisions or risks to weigh. verdict: one short sentence.',
].join('\n')

export function parseCritique(raw: string): Critique {
  const empty: Critique = { pros: [], cons: [], considerations: [], verdict: '', hasFeedback: false }
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
  if (!jsonText) return empty
  let parsed: unknown
  try { parsed = JSON.parse(jsonText) } catch { return empty }
  if (typeof parsed !== 'object' || parsed === null) return empty
  const r = parsed as Record<string, unknown>
  const list = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map(x => x.trim()).filter(Boolean).slice(0, 6) : []
  const pros = list(r.pros), cons = list(r.cons), considerations = list(r.considerations)
  const verdict = typeof r.verdict === 'string' ? r.verdict.trim().slice(0, 200) : ''
  return { pros, cons, considerations, verdict, hasFeedback: pros.length + cons.length + considerations.length > 0 }
}

export async function critiqueConcept(options: {
  goal: string
  overview: string
  features?: string[]
  generate?: typeof generateText
}): Promise<Critique> {
  const gen = options.generate ?? generateText
  const prompt = [
    `Goal: ${options.goal}`,
    `Blueprint: ${options.overview}`,
    options.features && options.features.length ? `Planned features: ${options.features.join('; ')}` : '',
    'Review it. Return the JSON critique.',
  ].filter(Boolean).join('\n')
  try {
    const result = await gen({ system: SYSTEM, prompt, maxTokens: 800, purpose: 'coding' })
    return parseCritique(result.text)
  } catch {
    return { pros: [], cons: [], considerations: [], verdict: 'Kritiker nicht verfügbar (kein KI-Provider) — Konzept unverändert.', hasFeedback: false }
  }
}
