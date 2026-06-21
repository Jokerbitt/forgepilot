/**
 * Reverse-Engineering — screenshot ingest (Vision).
 *
 * A screenshot of an existing app's UI reveals INTENT that the code scan can't
 * see: which screens, features and UI elements exist. A vision model describes
 * the screenshot; these hints enrich the rebuild (they can be dropped into the
 * rebuild's "custom step").
 *
 * The vision call itself runs in the API route (like /api/concept/analyze).
 * Here we keep the pure, testable parts: the prompt, robust JSON parsing of the
 * model output, and turning hints into a plain-German rebuild note.
 */
import { stripJsonCodeFence } from '@/lib/ai/text-generation'

export interface ScreenshotHints {
  /** 1-2 sentence description of the app/screen and its purpose. */
  summary: string
  /** Distinct screens/views visible or implied. */
  screens: string[]
  /** User-facing features the UI suggests. */
  features: string[]
  /** Important UI elements: forms, tables, filters, charts, navigation, key buttons. */
  uiElements: string[]
}

/** System prompt for the vision model — grounded UI description for a rebuild. */
export const SCREENSHOT_SYSTEM = `You are a senior software architect analyzing a SCREENSHOT of an existing application's user interface, to help plan a modern rebuild. Describe what the UI shows — screens, features and key UI elements — so a developer can recreate the functionality.

Output ONLY valid JSON — no markdown fences, no explanation. Schema:
{
  "summary": "1-2 sentences: what app/screen this is and its purpose",
  "screens": ["distinct screens/views visible or implied"],
  "features": ["user-facing features the UI suggests"],
  "uiElements": ["important UI elements: forms, tables, filters, charts, navigation, key buttons"]
}

Rules:
- Be concrete and grounded in what is actually visible — do NOT invent features.
- Keep each list item short. German or English labels are both fine.`

/** The user-message text that accompanies the image. */
export const SCREENSHOT_USER_PROMPT =
  'Analyze this UI screenshot of an existing app and return the JSON described in the system prompt.'

function toStringArray(value: unknown, max = 20): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map(x => x.trim())
    .slice(0, max)
}

/** Parse the vision model's raw output into ScreenshotHints — robust to junk. */
export function parseScreenshotHints(raw: string): ScreenshotHints {
  let parsed: Partial<ScreenshotHints> = {}
  try {
    parsed = JSON.parse(stripJsonCodeFence(raw)) as Partial<ScreenshotHints>
  } catch {
    /* keep empty — the route surfaces a parse error separately */
  }
  return {
    summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : '',
    screens: toStringArray(parsed.screens),
    features: toStringArray(parsed.features),
    uiElements: toStringArray(parsed.uiElements),
  }
}

/** Turn hints into a plain-German note that can seed the rebuild's custom step. */
export function buildScreenshotHintText(hints: ScreenshotHints): string {
  const parts: string[] = []
  if (hints.summary) parts.push(hints.summary)
  if (hints.screens.length) parts.push(`Screens: ${hints.screens.join(', ')}.`)
  if (hints.features.length) parts.push(`Funktionen: ${hints.features.join(', ')}.`)
  if (hints.uiElements.length) parts.push(`UI-Elemente: ${hints.uiElements.join(', ')}.`)
  return parts.join(' ')
}

/** True when the model returned no usable hints. */
export function isEmptyHints(hints: ScreenshotHints): boolean {
  return !hints.summary && hints.screens.length === 0 && hints.features.length === 0 && hints.uiElements.length === 0
}
