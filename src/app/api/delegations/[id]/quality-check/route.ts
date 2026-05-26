export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { execFileSync, execSync } from 'child_process'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import { generateText, stripJsonCodeFence } from '@/lib/ai/text-generation'
import type { DoDCriterion, DoDQualityCheck } from '@/lib/models/delegation'
import path from 'path'
import fs from 'fs'

const SYSTEM_PROMPT = `You are a senior code reviewer evaluating whether an agent's code changes satisfy the Definition of Done.

You will receive:
1. The task goal
2. The Definition of Done criteria
3. A git diff of the agent's changes

For each DoD criterion, determine if it is met based on the diff.
Output ONLY a JSON object in this exact shape (no markdown, no explanation):
{
  "criteria": [
    { "item": "<criterion text>", "met": true|false, "confidence": "high"|"medium"|"low", "notes": "<1 sentence why>" }
  ],
  "overallScore": <0-100 integer>,
  "verdict": "passed"|"partial"|"failed",
  "suggestion": "<optional: 1 sentence natural-language hint for the next retry if verdict != passed>"
}`

function isClaudeAvailable(): boolean {
  try {
    execSync('claude --version', { stdio: 'ignore', timeout: 3000 })
    return true
  } catch {
    return false
  }
}

function getGitDiff(repoPath: string, branchName: string): string {
  try {
    // Try to get diff between main and feature branch
    const diff = execFileSync(
      'git',
      ['diff', 'HEAD', branchName, '--stat', '--', '.'],
      { cwd: repoPath, timeout: 10_000, encoding: 'utf-8' }
    )
    const fullDiff = execFileSync(
      'git',
      ['diff', 'HEAD', branchName, '--', '.'],
      { cwd: repoPath, timeout: 10_000, encoding: 'utf-8' }
    )
    // Truncate to ~4000 chars to keep prompt small
    const combined = (diff + '\n' + fullDiff).slice(0, 4000)
    return combined || '(no diff found)'
  } catch {
    try {
      // Fall back: show last commit diff
      const lastDiff = execFileSync(
        'git',
        ['show', '--stat', 'HEAD'],
        { cwd: repoPath, timeout: 10_000, encoding: 'utf-8' }
      )
      return lastDiff.slice(0, 4000)
    } catch {
      return '(could not retrieve git diff)'
    }
  }
}

function buildPrompt(goal: string, dod: string[], diff: string): string {
  return `Task goal: ${goal}

Definition of Done:
${dod.map((d, i) => `${i + 1}. ${d}`).join('\n')}

Git diff (agent's changes):
\`\`\`
${diff}
\`\`\`

Evaluate each DoD criterion against the diff and return the JSON result.`
}

async function runCheck(goal: string, dod: string[], diff: string): Promise<string> {
  const prompt = buildPrompt(goal, dod, diff)

  // Try configured AI provider first
  try {
    const result = await generateText({
      system: SYSTEM_PROMPT,
      prompt,
      maxTokens: 1024,
      purpose: 'fast',
    })
    return result.text
  } catch {
    // Fall back to Claude CLI
    if (!isClaudeAvailable()) throw new Error('no-provider')
    return execFileSync(
      'claude',
      ['-p', prompt, '--system', SYSTEM_PROMPT, '--max-turns', '1', '--output-format', 'text'],
      { timeout: 30_000, encoding: 'utf-8' }
    ).trim()
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = await requireAuth()
  if (authError) return authError

  const { id } = await params
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const delegation = await repo.findById(id)

  if (!delegation) return NextResponse.json({ error: 'Delegation nicht gefunden' }, { status: 404 })
  if (delegation.status !== 'completed') {
    return NextResponse.json({ error: 'Quality Check nur für abgeschlossene Delegations möglich' }, { status: 400 })
  }

  const dod = delegation.contract.definitionOfDone
  if (!dod.length) {
    return NextResponse.json({ error: 'Keine DoD-Kriterien definiert' }, { status: 400 })
  }

  // Determine repo path for git diff
  const rawRepo = delegation.targetRepo ?? process.cwd()
  const repoPath = fs.existsSync(rawRepo) ? rawRepo : process.cwd()
  const branchName = `feature/${id}-task`

  const diff = getGitDiff(repoPath, branchName)

  let rawText: string
  try {
    rawText = await runCheck(delegation.contract.goal, dod, diff)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg === 'no-provider') {
      return NextResponse.json(
        { error: 'Kein KI-Provider konfiguriert und Claude CLI nicht verfügbar.' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: `KI-Fehler: ${msg}` }, { status: 500 })
  }

  // Parse result
  let qualityCheck: DoDQualityCheck
  try {
    const cleaned = stripJsonCodeFence(rawText)
    const parsed = JSON.parse(cleaned) as {
      criteria: DoDCriterion[]
      overallScore: number
      verdict: 'passed' | 'partial' | 'failed'
      suggestion?: string
    }
    qualityCheck = {
      criteria: parsed.criteria,
      overallScore: parsed.overallScore,
      verdict: parsed.verdict,
      suggestion: parsed.suggestion,
      checkedAt: new Date().toISOString(),
    }
  } catch {
    return NextResponse.json({ error: 'KI-Antwort konnte nicht geparst werden', raw: rawText }, { status: 500 })
  }

  // Persist quality check on delegation
  await repo.update(id, { qualityCheck })

  return NextResponse.json({ qualityCheck })
}

// GET — return stored quality check
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = await requireAuth()
  if (authError) return authError

  const { id } = await params
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const delegation = await repo.findById(id)

  if (!delegation) return NextResponse.json({ error: 'Delegation nicht gefunden' }, { status: 404 })
  if (!delegation.qualityCheck) return NextResponse.json({ qualityCheck: null })

  return NextResponse.json({ qualityCheck: delegation.qualityCheck })
}
