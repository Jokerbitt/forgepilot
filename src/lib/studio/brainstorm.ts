/**
 * Brainstorm step of the guided Idea Studio: turn a non-technical user's rough
 * idea into a clear, buildable goal — plus alternative directions so the user
 * makes an informed choice (the "decision support" the user asked for).
 *
 * AI-backed via generateText with tolerant parsing and a safe heuristic fallback,
 * so the wizard always advances even without an AI provider configured.
 */
import { generateText } from '@/lib/ai/text-generation'

export interface IdeaRefinement {
  /** A clear, one-paragraph build goal derived from the rough idea. */
  goal: string
  /** A short app name suggestion. */
  appName: string
  /** App type, e.g. "web app", "SaaS", "internal tool". */
  appType: string
  /** 2-3 alternative framings/directions the user can pick from. */
  directions: string[]
}

const SYSTEM = [
  'You help a NON-TECHNICAL person turn a rough idea into a clear, buildable app.',
  'No jargon. Be concrete and encouraging.',
  'Return ONLY JSON: {"goal": string, "appName": string, "appType": string, "directions": string[]}.',
  'goal: one clear paragraph describing what to build. appName: 1-3 words.',
  'appType: e.g. "web app", "SaaS", "internal tool", "marketing site".',
  'directions: 2-3 short alternative angles the user could take (one sentence each).',
].join('\n')

/** Tolerantly parse the refinement JSON from model output. */
export function parseRefinement(raw: string): IdeaRefinement | null {
  const text = raw.trim()
  let jsonText: string | null = null
  if (text.startsWith('{')) jsonText = text
  else {
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (fence?.[1]) jsonText = fence[1].trim()
    else {
      const start = text.indexOf('{')
      const end = text.lastIndexOf('}')
      if (start !== -1 && end > start) jsonText = text.slice(start, end + 1)
    }
  }
  if (!jsonText) return null
  let parsed: unknown
  try { parsed = JSON.parse(jsonText) } catch { return null }
  if (typeof parsed !== 'object' || parsed === null) return null
  const r = parsed as Record<string, unknown>
  const goal = typeof r.goal === 'string' ? r.goal.trim() : ''
  if (!goal) return null
  const directions = Array.isArray(r.directions)
    ? r.directions.filter((d): d is string => typeof d === 'string').map(d => d.trim()).filter(Boolean).slice(0, 3)
    : []
  return {
    goal: goal.slice(0, 800),
    appName: (typeof r.appName === 'string' && r.appName.trim() ? r.appName.trim() : deriveAppName(goal)).slice(0, 60),
    appType: typeof r.appType === 'string' && r.appType.trim() ? r.appType.trim().slice(0, 40) : 'web app',
    directions,
  }
}

/** Heuristic app name from a goal/idea (fallback when AI gives none). */
export function deriveAppName(text: string): string {
  const words = text.replace(/[^a-zA-Z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 3)
  const pick = words.slice(0, 2).map(w => w[0]!.toUpperCase() + w.slice(1).toLowerCase())
  return pick.join('') || 'MyApp'
}

/**
 * Refine a rough idea. Always returns a usable refinement — falls back to a
 * direct framing of the idea when AI is unavailable.
 */
export async function refineIdea(options: {
  idea: string
  generate?: typeof generateText
}): Promise<IdeaRefinement> {
  const idea = options.idea.trim()
  const gen = options.generate ?? generateText
  try {
    const result = await gen({ system: SYSTEM, prompt: `Rough idea: ${idea}`, maxTokens: 700, purpose: 'fast' })
    const parsed = parseRefinement(result.text)
    if (parsed) return parsed
  } catch { /* fall through to heuristic */ }
  return { goal: idea, appName: deriveAppName(idea), appType: 'web app', directions: [] }
}
