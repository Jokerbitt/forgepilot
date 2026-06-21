/**
 * Next-step suggestions — given the current goal/context of an app or project,
 * propose selectable next steps the user can pick from. The user selects some
 * (plus an optional custom one), and they become a validated delegation chain.
 *
 * AI-backed via generateText, with tolerant JSON parsing and a safe fallback.
 */
import { generateText } from '@/lib/ai/text-generation'
import type { CodebaseAnalysis } from './codebase-analyzer'
import { analysisToContext } from './codebase-analyzer'

export interface Suggestion {
  id: string
  title: string
  description: string
}

const SYSTEM = [
  'You are a senior product engineer proposing the next high-impact steps for a software project.',
  'Given the project goal and context, propose distinct, concrete, independently-buildable next steps.',
  'Each must be a real feature or improvement an AI agent can implement in one focused build.',
  'Return ONLY a JSON array of objects: [{"title": string, "description": string}]. No prose, no fences.',
  'Titles are short (<=6 words). Descriptions are one sentence on the value + scope.',
].join('\n')

/** Tolerantly parse a suggestions JSON array out of model output. */
export function parseSuggestions(raw: string, max = 6): Suggestion[] {
  const text = raw.trim()
  let jsonText: string | null = null
  if (text.startsWith('[')) jsonText = text
  else {
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (fence?.[1]) jsonText = fence[1].trim()
    else {
      const start = text.indexOf('[')
      const end = text.lastIndexOf(']')
      if (start !== -1 && end > start) jsonText = text.slice(start, end + 1)
    }
  }
  if (!jsonText) return []
  let parsed: unknown
  try { parsed = JSON.parse(jsonText) } catch { return [] }
  if (!Array.isArray(parsed)) return []

  const out: Suggestion[] = []
  for (const item of parsed) {
    if (out.length >= max) break
    if (typeof item !== 'object' || item === null) continue
    const rec = item as Record<string, unknown>
    const title = typeof rec.title === 'string' ? rec.title.trim().slice(0, 120) : ''
    const description = typeof rec.description === 'string' ? rec.description.trim().slice(0, 400) : ''
    if (!title) continue
    out.push({ id: `s${out.length + 1}`, title, description })
  }
  return out
}

/**
 * Generate next-step suggestions for a goal/context.
 * `generate` is injectable for testing; defaults to the real AI helper.
 * Returns [] when generation fails — the caller decides on a fallback.
 */
export async function generateSuggestions(options: {
  goal: string
  context?: string
  count?: number
  generate?: typeof generateText
}): Promise<Suggestion[]> {
  const { goal, context = '', count = 5 } = options
  const gen = options.generate ?? generateText
  const prompt = [
    `Project goal: ${goal}`,
    context ? `Context: ${context}` : '',
    `Propose ${count} next steps as a JSON array.`,
  ].filter(Boolean).join('\n')
  try {
    const result = await gen({ system: SYSTEM, prompt, maxTokens: 900, purpose: 'fast' })
    return parseSuggestions(result.text, count)
  } catch {
    return []
  }
}

const IMPROVE_SYSTEM = [
  'You are a senior engineer auditing an EXISTING application and proposing concrete improvements.',
  'You are given a factual analysis of the codebase (stack, dependencies, structure, risk signals).',
  'Propose distinct, high-impact improvements that fit THIS app — each independently buildable by an AI agent in one focused build.',
  'Ground every suggestion in the analysis: prefer fixing the named signals (missing tests, no TypeScript, no CI, TODOs, docs gaps) and strengthening the detected stack.',
  'Do NOT propose a full rewrite or anything that requires throwing the app away.',
  'Return ONLY a JSON array of objects: [{"title": string, "description": string}]. No prose, no fences.',
  'Titles are short (<=6 words). Descriptions are one sentence on the value + scope.',
].join('\n')

/**
 * Generate context-aware improvement suggestions for an EXISTING app, grounded
 * in a CodebaseAnalysis. `focus` optionally biases the suggestions (e.g.
 * "performance", "testing"). `generate` is injectable for testing.
 * Returns [] when generation fails — the caller decides on a fallback.
 */
export async function generateImprovementSuggestions(options: {
  analysis: CodebaseAnalysis
  focus?: string
  count?: number
  generate?: typeof generateText
}): Promise<Suggestion[]> {
  const { analysis, focus = '', count = 5 } = options
  const gen = options.generate ?? generateText
  const prompt = [
    'Codebase analysis:',
    analysisToContext(analysis),
    focus ? `\nFocus the suggestions on: ${focus}` : '',
    `\nPropose ${count} concrete improvements as a JSON array.`,
  ].filter(Boolean).join('\n')
  try {
    const result = await gen({ system: IMPROVE_SYSTEM, prompt, maxTokens: 900, purpose: 'fast' })
    return parseSuggestions(result.text, count)
  } catch {
    return []
  }
}
