export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { Delegation } from '@/lib/models/delegation'
import { createGitHubPR } from '@/lib/github/pr-creator'
import { generateText } from '@/lib/ai/text-generation'

const DELEGATIONS_FILE = path.join(process.cwd(), 'config', 'delegations.json')

function readDelegations(): Delegation[] {
  try {
    return JSON.parse(fs.readFileSync(DELEGATIONS_FILE, 'utf-8')) as Delegation[]
  } catch {
    return []
  }
}

function writeDelegationsAtomic(delegations: Delegation[]) {
  const dir = path.dirname(DELEGATIONS_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = DELEGATIONS_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(delegations, null, 2), 'utf-8')
  fs.renameSync(tmp, DELEGATIONS_FILE)
}

/**
 * Generate a concise PR body using AI (purpose: 'fast', ~100 words).
 * Falls back to a static description if AI is unavailable.
 */
async function generatePRBody(delegation: Delegation): Promise<string> {
  const goal = delegation.contract.goal
  const dod = (delegation.contract.definitionOfDone ?? [])
    .filter(Boolean)
    .map(d => `- ${d}`)
    .join('\n') || '- Task completed successfully'

  try {
    const result = await generateText({
      system: 'You are a concise technical writer. Write GitHub PR descriptions in plain English. Be factual and brief.',
      prompt: `Write a GitHub PR description in ~100 words for this completed delegation task.

Task: ${goal}

Definition of Done:
${dod}

Format:
## Summary
[2–3 bullet points describing what was done]

## Changes
[1–2 bullets on key files/areas changed]

## Test plan
- [ ] Tests pass
- [ ] Type-check clean`,
      maxTokens: 300,
      purpose: 'fast',
    })
    return result.text
  } catch {
    // AI unavailable — use static fallback
    return `## Summary
- Delegation task completed: ${goal.slice(0, 120)}

## Definition of Done
${dod}

## Test plan
- [ ] Tests pass
- [ ] Type-check clean`
  }
}

/**
 * POST /api/delegations/[id]/create-pr
 *
 * Creates a GitHub PR for a completed delegation.
 * Persists the PR URL in delegation.summaryReport.prUrl.
 *
 * Body (all optional):
 *   { branch?: string, baseBranch?: string }
 *
 * Response:
 *   { prUrl: string, prNumber: number, status: 'created' | 'already_exists' | 'error', error?: string }
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const { id } = params

  const delegations = readDelegations()
  const delegation = delegations.find(d => d.id === id)

  if (!delegation) {
    return NextResponse.json({ error: 'Delegation nicht gefunden' }, { status: 404 })
  }

  if (delegation.status !== 'completed') {
    return NextResponse.json(
      { error: `Delegation ist nicht abgeschlossen (Status: ${delegation.status})` },
      { status: 400 },
    )
  }

  // Parse optional overrides from request body
  let bodyOverrides: { branch?: string; baseBranch?: string } = {}
  try {
    bodyOverrides = (await req.json()) as { branch?: string; baseBranch?: string }
  } catch {
    // No body or invalid JSON — use defaults
  }

  // Derive branch name the same way the execute route does
  const slug = delegation.contract.workItemId
    .replace(/[^a-z0-9-]/gi, '-')
    .toLowerCase()
  const branch = bodyOverrides.branch
    ?? `${delegation.contract.branchStrategy}/${slug}-task`

  const title = `feat(delegation): ${delegation.title || delegation.contract.goal.slice(0, 60)}`
  const body = await generatePRBody(delegation)

  const prResult = await createGitHubPR({
    title,
    body,
    branch,
    baseBranch: bodyOverrides.baseBranch,
    labels: ['delegation', delegation.contract.taskType ?? 'feature'].filter(Boolean),
  })

  // Persist PR URL in delegation regardless of 'created' vs 'already_exists'
  if (prResult.url) {
    const idx = delegations.findIndex(d => d.id === id)
    if (idx >= 0) {
      delegations[idx] = {
        ...delegations[idx],
        summaryReport: {
          keyPoints: delegations[idx].summaryReport?.keyPoints ?? [delegation.contract.goal],
          changes: delegations[idx].summaryReport?.changes ?? [],
          timeTakenMinutes: delegations[idx].summaryReport?.timeTakenMinutes ?? 0,
          ...delegations[idx].summaryReport,
          prUrl: prResult.url,
        },
        updatedAt: new Date().toISOString(),
      }
      writeDelegationsAtomic(delegations)
    }
  }

  return NextResponse.json({
    prUrl: prResult.url,
    prNumber: prResult.number,
    status: prResult.status,
    ...(prResult.error ? { error: prResult.error } : {}),
  })
}
