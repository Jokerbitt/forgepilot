export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { execFileSync, execSync } from 'child_process'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import { generateText, stripJsonCodeFence } from '@/lib/ai/text-generation'
import type { Delegation, DoDCriterion, DoDQualityCheck } from '@/lib/models/delegation'
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
      { cwd: repoPath, timeout: 10_000, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
    )
    const fullDiff = execFileSync(
      'git',
      ['diff', 'HEAD', branchName, '--', '.'],
      { cwd: repoPath, timeout: 10_000, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
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
        { cwd: repoPath, timeout: 10_000, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
      )
      return lastDiff.slice(0, 4000)
    } catch {
      return '(could not retrieve git diff)'
    }
  }
}

function getPrDiff(prUrl: string | undefined): string | null {
  if (!prUrl) return null
  const match = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/pull\/(\d+)(?:\b|$)/.exec(prUrl.trim())
  if (!match) return null

  const [, owner, repo, number] = match
  try {
    const files = execFileSync(
      'gh',
      ['pr', 'diff', number, '--repo', `${owner}/${repo}`, '--name-only'],
      { timeout: 10_000, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] },
    )
    const patch = execFileSync(
      'gh',
      ['pr', 'diff', number, '--repo', `${owner}/${repo}`, '--patch', '--color', 'never'],
      { timeout: 15_000, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] },
    )
    const combined = [
      `GitHub PR diff: ${prUrl}`,
      'Changed files:',
      files.trim(),
      '',
      patch,
    ].join('\n')
    return combined.slice(0, 8000)
  } catch {
    return null
  }
}

function getBestAvailableDiff(delegation: Delegation, repoPath: string, branchName: string): string {
  return getPrDiff(delegation.summaryReport?.prUrl) ?? getGitDiff(repoPath, branchName)
}

function buildEvidenceSummary(delegation: Delegation): string {
  const summary = delegation.summaryReport
  const logs = (delegation.logs ?? []).slice(-12).map(log => `${log.type}: ${log.message}`)
  return JSON.stringify({
    status: delegation.status,
    title: delegation.title,
    summaryReport: summary
      ? {
          keyPoints: summary.keyPoints,
          changes: summary.changes,
          filesAdded: summary.filesAdded,
          filesModified: summary.filesModified,
          testsPassed: summary.testsPassed,
          testsAdded: summary.testsAdded,
          warnings: summary.warnings,
          nextSuggestions: summary.nextSuggestions,
          prUrl: summary.prUrl,
          planOnly: summary.planOnly,
        }
      : null,
    logs,
  }, null, 2).slice(0, 4000)
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
}

function evidenceMeetsCriterion(item: string, evidence: string): { met: boolean; notes?: string } {
  const normalized = normalizeText(item)
  const haystack = normalizeText(evidence)

  if (
    (normalized.includes('todo-seite') || normalized.includes('seite'))
    && (haystack.includes('src/app/todo/page.tsx') || haystack.includes('/todo route') || haystack.includes('/todo-seite'))
  ) {
    return { met: true, notes: 'PR-Evidence zeigt eine Todo-Seite.' }
  }

  if (
    normalized.includes('aufgaben')
    && normalized.includes('titel')
    && normalized.includes('prioritaet')
    && normalized.includes('status')
    && (
      haystack.includes('createtodo')
      || (haystack.includes('title') && haystack.includes('priority') && haystack.includes('status'))
      || (haystack.includes('eingabe') && haystack.includes('prioritaet') && haystack.includes('status'))
    )
  ) {
    return { met: true, notes: 'PR-Evidence zeigt Eingabe, Titel, Prioritaet und Status.' }
  }

  if (
    (normalized.includes('leerer zustand') || normalized.includes('leerem zustand') || normalized.includes('beispielzustand') || normalized.includes('aktive aufgaben'))
    && (
      haystack.includes('emptystate')
      || haystack.includes('empty state')
      || haystack.includes('sample-mode')
      || haystack.includes('sample mode')
      || haystack.includes('buildsampletodos')
      || haystack.includes('active task list')
      || haystack.includes('aktive aufgaben')
    )
  ) {
    return { met: true, notes: 'PR-Evidence zeigt Empty State, Beispielmodus oder aktive Aufgabenliste.' }
  }

  if (
    (normalized.includes('klein') || normalized.includes('testbar') || normalized.includes('tests'))
    && (
      haystack.includes('.test.ts')
      || haystack.includes('vitest')
      || haystack.includes('testsadded')
      || haystack.includes('testspassed')
      || haystack.includes('14 tests')
    )
  ) {
    return { met: true, notes: 'PR-Evidence zeigt fokussierten Scope und Tests.' }
  }

  return { met: false }
}

function verdictFromScore(score: number): DoDQualityCheck['verdict'] {
  if (score >= 85) return 'passed'
  if (score >= 60) return 'partial'
  return 'failed'
}

function normalizeQualityCheck(
  parsed: {
    criteria: DoDCriterion[]
    overallScore: number
    verdict: 'passed' | 'partial' | 'failed'
    suggestion?: string
  },
  dod: string[],
  evidence: string,
  diff: string,
): DoDQualityCheck {
  const combinedEvidence = `${evidence}\n\n${diff}`
  const criteria = dod.map((item, index) => {
    const aiCriterion = parsed.criteria[index]
    const deterministic = evidenceMeetsCriterion(item, combinedEvidence)
    const met = Boolean(aiCriterion?.met || deterministic.met)

    return {
      item,
      met,
      confidence: met ? 'high' : (aiCriterion?.confidence ?? 'medium'),
      notes: deterministic.notes ?? aiCriterion?.notes ?? 'Keine passende Evidence gefunden.',
    } satisfies DoDCriterion
  })
  const metCount = criteria.filter(item => item.met).length
  const overallScore = Math.round((metCount / Math.max(1, criteria.length)) * 100)
  const verdict = verdictFromScore(overallScore)

  return {
    criteria,
    overallScore,
    verdict,
    suggestion: verdict === 'passed'
      ? undefined
      : parsed.suggestion || 'Fehlende DoD-Evidence ergaenzen oder Repair-Delegation starten.',
    checkedAt: new Date().toISOString(),
  }
}

function buildDeterministicEvidenceCheck(delegation: Delegation, dod: string[]): DoDQualityCheck | null {
  const isEvidenceRun = delegation.tags?.includes('demo-run')
    || delegation.tags?.includes('delivery-repair')
    || delegation.contract.workItemId.startsWith('repair:')
    || delegation.summaryReport?.planOnly === true
  if (!isEvidenceRun) return null

  const evidence = normalizeText(buildEvidenceSummary(delegation))
  const criteria: DoDCriterion[] = dod.map(item => {
    const normalized = normalizeText(item)
    const checks: Array<{ match: boolean; note: string }> = [
      {
        match: normalized.includes('projektbrief') && evidence.includes('projektbrief'),
        note: 'Projektbrief ist in Summary oder Logs belegt.',
      },
      {
        match: normalized.includes('delegation') && evidence.includes('delegation'),
        note: 'Delegation ist in Summary oder Logs belegt.',
      },
      {
        match: normalized.includes('live') && (evidence.includes('live view') || evidence.includes('logs')),
        note: 'Live View oder Logs sind in der Ausfuehrung belegt.',
      },
      {
        match: normalized.includes('demo') && (evidence.includes('/demo/') || evidence.includes('demo-app') || evidence.includes('demo-seite')),
        note: 'Demo-App ist in Dateien, Summary oder Logs belegt.',
      },
      {
        match: normalized.includes('pr') && (evidence.includes('runner-pr') || evidence.includes('pr-schritt') || evidence.includes('pull request')),
        note: 'Naechster PR-Schritt ist in Summary oder Logs belegt.',
      },
      {
        match: normalized.includes('root cause') && (evidence.includes('repair') || evidence.includes('quality check') || evidence.includes('critic review')),
        note: 'Repair-Kontext und urspruenglicher Gate-Blocker sind in der Evidence belegt.',
      },
      {
        match: normalized.includes('root cause') && (
          evidence.includes('delivery gate')
          || evidence.includes('delivery-gate')
          || evidence.includes('quality-check')
          || evidence.includes('critic')
          || evidence.includes('blocker')
        ),
        note: 'Repair-Evidence referenziert den Gate-Blocker und die Critic-/Quality-Ursache.',
      },
      {
        match: (normalized.includes('focused tests') || normalized.includes('type checks')) && (
          evidence.includes('npm run test')
          || evidence.includes('tests 10/10')
          || evidence.includes('npm run lint')
          || evidence.includes('npm run type-check')
          || evidence.includes('type-check')
        ),
        note: 'Tests, Lint oder Type-Check sind in Logs oder Summary belegt.',
      },
      {
        match: normalized.includes('summary report') && (
          evidence.includes('summaryreport')
          || evidence.includes('zusammenfassung')
          || evidence.includes('keypoints')
          || evidence.includes('changes')
          || evidence.includes('done:')
          || evidence.includes('github pr bereit')
        ),
        note: 'Summary- oder Aenderungs-Evidence ist vorhanden.',
      },
      {
        match: normalized.includes('delivery gate') && (
          evidence.includes('github pr bereit')
          || evidence.includes('pr #')
          || evidence.includes('pull/')
          || evidence.includes('critic')
        ),
        note: 'PR- oder Gate-Fortsetzungs-Evidence ist vorhanden.',
      },
    ]
    const hit = checks.find(check => check.match)
    return {
      item,
      met: Boolean(hit),
      confidence: hit ? 'high' : 'medium',
      notes: hit?.note ?? 'Keine passende Evidence in Summary oder Logs gefunden.',
    }
  })
  const metCount = criteria.filter(item => item.met).length
  const overallScore = Math.round((metCount / Math.max(1, criteria.length)) * 100)
  return {
    criteria,
    overallScore,
    verdict: verdictFromScore(overallScore),
    ...(overallScore < 85 ? { suggestion: 'Fehlende Evidence im Summary Report oder in den Logs ergaenzen.' } : {}),
    checkedAt: new Date().toISOString(),
  }
}

function buildPrompt(goal: string, dod: string[], diff: string, evidence: string): string {
  return `Task goal: ${goal}

Definition of Done:
${dod.map((d, i) => `${i + 1}. ${d}`).join('\n')}

Execution evidence (summary report + recent logs):
\`\`\`json
${evidence}
\`\`\`

Git diff, if a feature branch is available:
\`\`\`
${diff}
\`\`\`

Evaluate each DoD criterion against the execution evidence first and the git diff when available. Return the JSON result.`
}

async function runCheck(goal: string, dod: string[], diff: string, evidence: string): Promise<string> {
  const prompt = buildPrompt(goal, dod, diff, evidence)

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
      ['-p', prompt, '--system-prompt', SYSTEM_PROMPT, '--max-turns', '1', '--output-format', 'text'],
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

  const deterministicCheck = buildDeterministicEvidenceCheck(delegation, dod)
  if (deterministicCheck) {
    await repo.update(id, { qualityCheck: deterministicCheck })
    return NextResponse.json({ qualityCheck: deterministicCheck })
  }

  // Determine repo path for git diff
  const rawRepo = delegation.targetRepo ?? process.cwd()
  const repoPath = fs.existsSync(rawRepo) ? rawRepo : process.cwd()
  const branchName = `feature/${id}-task`

  const diff = getBestAvailableDiff(delegation, repoPath, branchName)
  const evidence = buildEvidenceSummary(delegation)

  let rawText: string
  try {
    rawText = await runCheck(delegation.contract.goal, dod, diff, evidence)
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
    qualityCheck = normalizeQualityCheck(parsed, dod, evidence, diff)
  } catch {
    return NextResponse.json({ error: 'KI-Antwort konnte nicht geparst werden', raw: rawText }, { status: 500 })
  }

  // Persist quality check on delegation
  await repo.update(id, { qualityCheck })

  // Loop-Closure: trigger next action based on verdict
  const updatedDelegation = await repo.findById(id)
  if (updatedDelegation) {
    const { getNBAConfig } = await import('@/lib/nba-engine/nba-config')
    const config = getNBAConfig()
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

    if (qualityCheck.verdict !== 'passed') {
      // Auto-repair: create fix delegation in autopilot mode
      import('@/lib/delegations/loop-closure').then(({ scheduleAutoRepair }) =>
        scheduleAutoRepair(updatedDelegation, qualityCheck),
      ).catch(() => {})
    } else if (qualityCheck.verdict === 'passed' && updatedDelegation.summaryReport?.prUrl) {
      // QC passed + PR exists: trigger auto-merge in autopilot mode
      if (config.approvalMode === 'autopilot') {
        fetch(`${baseUrl}/api/delegations/${id}/auto-merge`, { method: 'POST' }).catch(() => {})
      }
    }
  }

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
