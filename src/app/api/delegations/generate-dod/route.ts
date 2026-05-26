export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { execFileSync, execSync } from 'child_process'
import { generateText, stripJsonCodeFence } from '@/lib/ai/text-generation'

const SYSTEM_PROMPT = `You are a senior software engineer helping define acceptance criteria.
Given a task goal and optional context, generate 4-6 concrete, testable Definition of Done criteria.

Rules:
- Each criterion must be independently verifiable (not vague like "code is clean")
- Use active voice: "Badge shows High/Medium/Low labels", not "Labels should be shown"
- Cover: visual/functional correctness, edge cases, accessibility, no regressions
- Output ONLY a JSON array of strings, no markdown fences, no explanation

Example output:
["Badges display correct color for High (red), Medium (yellow), Low (green)", "Long todo titles do not break badge layout", "aria-label is set on each badge for screen readers", "Existing todo items are unaffected by the new badges"]`

function generateViaCLI(goal: string, context: string): string {
  const prompt = `Task goal: ${goal}${context ? `\nContext: ${context}` : ''}\n\nGenerate 4-6 Definition of Done criteria as a JSON array of strings.`
  const result = execFileSync(
    'claude',
    ['-p', prompt, '--system-prompt', SYSTEM_PROMPT, '--max-turns', '1', '--output-format', 'text'],
    { timeout: 30_000, encoding: 'utf-8' }
  )
  return result.trim()
}

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
  if (!goal) {
    return NextResponse.json({ error: 'goal ist Pflichtfeld' }, { status: 400 })
  }
  const context = (body.context ?? '').trim()

  let rawText: string

  // Try configured AI provider first, fall back to Claude CLI (uses subscription)
  try {
    const result = await generateText({
      system: SYSTEM_PROMPT,
      prompt: `Task goal: ${goal}${context ? `\nContext: ${context}` : ''}\n\nGenerate 4-6 Definition of Done criteria as a JSON array of strings.`,
      maxTokens: 512,
      purpose: 'fast',
    })
    rawText = result.text
  } catch {
    // Fall back to CLI (Max subscription / Claude.ai account)
    if (!isClaudeAvailable()) {
      return NextResponse.json(
        { error: 'Kein KI-Provider konfiguriert und Claude CLI nicht verfügbar. Bitte in Einstellungen → KI-Provider konfigurieren.' },
        { status: 503 }
      )
    }
    try {
      rawText = generateViaCLI(goal, context)
    } catch (cliErr) {
      const msg = cliErr instanceof Error ? cliErr.message : String(cliErr)
      return NextResponse.json({ error: `CLI-Fehler: ${msg}` }, { status: 500 })
    }
  }

  // Parse JSON array from response
  try {
    const cleaned = stripJsonCodeFence(rawText)
    const dod = JSON.parse(cleaned) as unknown
    if (!Array.isArray(dod) || dod.some(d => typeof d !== 'string')) {
      throw new Error('Unexpected format')
    }
    return NextResponse.json({ dod: dod as string[] })
  } catch {
    // Fallback: extract lines that look like list items
    const lines = rawText
      .split('\n')
      .map(l => l.replace(/^[-*•\d.)\s"]+/, '').replace(/[",\]]+$/, '').trim())
      .filter(l => l.length > 10)
    if (lines.length >= 2) {
      return NextResponse.json({ dod: lines.slice(0, 6) })
    }
    return NextResponse.json({ error: 'KI-Antwort konnte nicht geparst werden', raw: rawText }, { status: 500 })
  }
}
