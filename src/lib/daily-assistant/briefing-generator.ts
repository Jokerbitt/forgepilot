/**
 * briefing-generator.ts — AI-generated daily morning briefing for the Daily Assistant.
 *
 * Calls generateText() with a German-language system prompt to produce a concise,
 * data-driven briefing text. Falls back to rule-based text if AI is unavailable.
 */

import { generateText } from '@/lib/ai/text-generation'

export interface BriefingInput {
  pending: number
  approved: number
  running: number
  failed: number
  completedToday: number
  prOpen: number
  qualityPassRate: number | null
  topPendingGoal?: string
}

/**
 * Rule-based fallback briefing — no AI call needed.
 */
export function generateFallbackBriefing(input: BriefingInput): string {
  if (input.failed > 0) {
    return `${input.failed} Delegation${input.failed > 1 ? 'en' : ''} fehlgeschlagen — Fehler analysieren und Review-Retry starten.`
  }
  if (input.approved > 0) {
    return `${input.approved} Delegation${input.approved > 1 ? 'en sind' : ' ist'} freigegeben und wartet auf Start.`
  }
  if (input.running > 0) {
    return `${input.running} Agent${input.running > 1 ? 'en arbeiten' : ' arbeitet'} gerade. Ergebnisse prüfen sobald fertig.`
  }
  if (input.completedToday > 0) {
    return `Heute ${input.completedToday} Task${input.completedToday > 1 ? 's' : ''} abgeschlossen. Guter Tag bisher.`
  }
  return 'Keine aktiven Delegationen. Plan Mode starten um mit einer neuen Aufgabe zu beginnen.'
}

/**
 * Generates a short AI-powered daily briefing text in German.
 * Falls back to rule-based text on error.
 */
export async function generateDailyBriefing(input: BriefingInput): Promise<string> {
  try {
    const result = await generateText({
      system:
        'Du bist ForgePilots Daily Assistant. Schreibe einen kurzen (2-3 Sätze), konkreten deutschen Morgen-Briefing-Text für einen Entwickler. Nutze die aktuellen Zahlen um spezifisch zu sein. Keine Floskeln.',
      prompt: JSON.stringify(input),
      maxTokens: 200,
      purpose: 'fast',
    })
    return result.text.trim()
  } catch {
    return generateFallbackBriefing(input)
  }
}
