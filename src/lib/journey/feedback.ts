/**
 * Journey Companion — Phase 1.3: natural-language feedback → next change.
 *
 * A non-techie looks at the built app and says what they want in plain words
 * ("der Button gehört nach oben", "es stürzt beim Speichern ab", "füge einen
 * Export hinzu"). This turns that into a single, clearly-scoped build step that
 * feeds the existing validated build flow (suggestionsToPlan → executor).
 *
 * Pure: classification + step shaping only; the API does the I/O.
 */

export type FeedbackKind = 'ui' | 'bug' | 'feature' | 'change'

const BUG_HINTS = ['fehler', 'geht nicht', 'funktioniert nicht', 'kaputt', 'stürzt', 'absturz', 'crash', 'bug', 'error', 'falsch berechnet']
const UI_HINTS = ['farbe', 'button', 'knopf', 'design', 'layout', 'schrift', 'größer', 'kleiner', 'verschieb', 'oben', 'unten', 'links', 'rechts', 'aussehen', 'style', 'abstand', 'dunkel', 'hell']
const FEATURE_HINTS = ['füge', 'hinzufügen', 'ergänze', 'neue funktion', 'neuer', 'neue', 'add ', 'feature', 'können', 'möglichkeit', 'export', 'import', 'login']

/** Classify free-text feedback into a coarse kind (German + English hints). */
export function classifyFeedback(text: string): FeedbackKind {
  const t = text.toLowerCase()
  if (BUG_HINTS.some(h => t.includes(h))) return 'bug'
  if (FEATURE_HINTS.some(h => t.includes(h))) return 'feature'
  if (UI_HINTS.some(h => t.includes(h))) return 'ui'
  return 'change'
}

const KIND_TITLE: Record<FeedbackKind, string> = {
  ui: 'UI-Anpassung',
  bug: 'Fehler beheben',
  feature: 'Neue Funktion',
  change: 'Änderung',
}

const KIND_PREFIX: Record<FeedbackKind, string> = {
  ui: 'Oberfläche anpassen',
  bug: 'Gemeldeten Fehler beheben und mit einem Test absichern',
  feature: 'Funktion ergänzen',
  change: 'Gewünschte Änderung umsetzen',
}

export interface FeedbackStep {
  kind: FeedbackKind
  title: string
  description: string
}

/**
 * Turn feedback text into a build step, or null when the text is too short to act on.
 */
export function feedbackToStep(feedback: string): FeedbackStep | null {
  const text = feedback.trim()
  if (text.length < 3) return null
  const kind = classifyFeedback(text)
  return {
    kind,
    title: KIND_TITLE[kind],
    description: `${KIND_PREFIX[kind]}: „${text}". Bestehendes Verhalten erhalten, nur das Gewünschte ändern; Build grün + Tests bestehen.`,
  }
}
