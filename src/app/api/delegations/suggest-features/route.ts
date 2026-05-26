export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { execFileSync, execSync } from 'child_process'
import { generateText, stripJsonCodeFence } from '@/lib/ai/text-generation'

export interface FeatureSuggestion {
  name: string
  complexity: 'Klein' | 'Mittel' | 'Groß'
  when: string        // e.g. "Direkt danach", "Nach Dark Mode", "Jederzeit"
  goal: string        // ready-to-use delegation goal text
}

const SYSTEM_PROMPT = `You are a product manager suggesting follow-up features for a software project.
Given the current feature being built, suggest 5-7 logical next features.

Output ONLY a JSON array, no markdown fences, no explanation:
[
  {
    "name": "Short feature name (2-4 words)",
    "complexity": "Klein" | "Mittel" | "Groß",
    "when": "Short timing hint (e.g. 'Direkt danach', 'Parallel möglich', 'Nach X', 'Jederzeit')",
    "goal": "Ready-to-use delegation goal in the same language as the input (1-2 sentences, imperative)"
  }
]

Rules:
- Order by logical dependency (things that build on each other come later)
- complexity: Klein = <2h agent work, Mittel = 2-4h, Groß = >4h
- "when" should reference the current feature or other suggested features by name
- "goal" must be specific enough to use directly as a delegation task`

function isClaudeAvailable(): boolean {
  try {
    execSync('claude --version', { stdio: 'ignore', timeout: 3000 })
    return true
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError

  const body = await req.json() as { goal?: string; context?: string }
  const goal = (body.goal ?? '').trim()
  if (!goal) return NextResponse.json({ error: 'goal ist Pflichtfeld' }, { status: 400 })
  const context = (body.context ?? '').trim()

  const prompt = `Current feature being built: ${goal}${context ? `\nProject context: ${context}` : ''}\n\nSuggest 5-7 logical follow-up features as a JSON array.`

  let rawText: string
  try {
    const result = await generateText({ system: SYSTEM_PROMPT, prompt, maxTokens: 800, purpose: 'fast' })
    rawText = result.text
  } catch {
    if (!isClaudeAvailable()) {
      return NextResponse.json({ error: 'Kein KI-Provider konfiguriert und Claude CLI nicht verfügbar.' }, { status: 503 })
    }
    try {
      rawText = execFileSync(
        'claude', ['-p', prompt, '--system-prompt', SYSTEM_PROMPT, '--max-turns', '1', '--output-format', 'text'],
        { timeout: 30_000, encoding: 'utf-8' }
      ).trim()
    } catch (e) {
      return NextResponse.json({ error: `CLI-Fehler: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 })
    }
  }

  try {
    const features = JSON.parse(stripJsonCodeFence(rawText)) as unknown
    if (!Array.isArray(features)) throw new Error('not array')
    return NextResponse.json({ features: features as FeatureSuggestion[] })
  } catch {
    return NextResponse.json({ error: 'KI-Antwort konnte nicht geparst werden', raw: rawText }, { status: 500 })
  }
}
