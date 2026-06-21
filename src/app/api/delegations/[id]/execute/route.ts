export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { delegationLogger } from '@/lib/logger'
import { withSpan } from '@/lib/tracing/tracer'
import { checkRateLimit, buildRateLimitHeaders } from '@/lib/rate-limit'
import { spawn, execSync } from 'child_process'
import fsSync from 'fs'
import pathMod from 'path'
import type { Delegation, AgentLog, DelegationReport } from '@/lib/models/delegation'
import { registerProcess, unregisterProcess } from '@/lib/process-registry'
import { readConnectorConfigs, readStoredApiKeys } from '@/lib/connectors/config'
import { getGitHubPullRequestPreview, mergeGitHubPullRequest } from '@/lib/connectors/github'
import { postLinearCompletionComment } from '@/lib/connectors/linear-writeback'
import { createGitHubPRIfNeeded } from '@/lib/github/pr-creator'
import { evaluateMergeSafety } from '@/lib/github/merge-safety'
import { upsertAttentionItem } from '@/lib/attention/store'
import {
  buildExecutionStartLog,
  buildSimulationBudgetLog,
  getExecutionStartBlocker,
  buildSubTaskPrompt,
  buildRetryContext,
} from '@/lib/delegation-execution'
import { buildSelectiveContext } from '@/lib/delegations/context-router'
import { OllamaAgentRunner, isOllamaReachable } from '@/lib/agent-runner/ollama-runner'
import { budgetToClaudeCliMaxTurns, budgetToMaxTurns } from '@/lib/budget-utils'
import { scoreWork } from '@/lib/agents/work-quality'
import { recordOutcome } from '@/lib/agents/skill-evolver'
import { runWithToolUse } from '@/lib/agents/tool-use-runner'
import { extractKnowledge } from '@/lib/knowledge/extraction'
import { persistGrokCriticForDelegation } from '@/lib/eval/auto-grok-critic'
import { writebackExecutionInsights, writebackDelegationKnowledge, writeFailureLessonCard } from '@/lib/knowledge/writeback'
import { notifyExecutionResult, notifyBudgetWarning } from '@/lib/notifications'
import { checkBudget, getBudgetLimit, wouldExceedBudget } from '@/lib/budget/guard'
import { triggerChain } from '@/lib/delegations/chaining'
import { decidePhaseGate } from '@/lib/delegations/phase-gate'
import { resolveVerifyScripts, verifyCommand } from '@/lib/delegations/verify-scripts'

import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import { buildContextPackage } from '@/lib/knowledge/context-package'
import type { MemoryCard } from '@/lib/knowledge/types'
import { checkParallelCompletion } from '@/lib/delegation-parallel'
import { triggerCriticRetry } from '@/lib/delegations/critic-retry'
import { recordRuntimeExecuteLoopEvidence } from '@/lib/reports/execute-loop-runtime-evidence'
import { prepareRunnerWorkspace, shouldKeepRunnerWorktree, writebackLocalResult, reuseExistingWorkspace, type RunnerWorkspace } from '@/lib/agent-runner/worktree'
import { bootstrapRuntime, summarizeBootstrap, smokeTestApp } from '@/lib/agent-runner/runtime-bootstrap'
import { autoScaffoldWorkspace } from '@/lib/building-blocks/create-app'
import { scopedScaffoldBlockIds } from '@/lib/building-blocks/catalog'
import { getNBAConfig } from '@/lib/nba-engine/nba-config'
import { recordSkillOutcome, listSkills, seedBuiltinSkills } from '@/lib/skills/prompt-skill-registry'
import { applyAutoOptimizations } from '@/lib/skills/skill-optimizer'
import { detectKnownError, classifyError, extractErrorSnippet } from '@/lib/runner-health/error-classifier'
import { quickPreflightCheck } from '@/lib/runner-health/runner-detector'
import { getCachedOrShallowRunnerReadiness, getRunnerReadiness, writeCachedRunnerReadiness } from '@/lib/system/runner-readiness'
import { selectDelegationExecutionMode } from '@/lib/delegations/execution-mode'

async function appendLogs(id: string, newLogs: AgentLog[], statusOverride?: Delegation['status'], report?: DelegationReport) {
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const current = await repo.findById(id)
  if (!current) return
  await repo.update(id, {
    ...(statusOverride ? { status: statusOverride } : {}),
    ...(report ? { summaryReport: report } : {}),
    logs: [...(current.logs ?? []), ...newLogs],
  })
}

/**
 * Compact retry prompt — replaces the full buildPrompt() on auto-retry runs.
 * Saves ~70% tokens by omitting skill/knowledge/codebase blocks already in the agent's context.
 * Includes ONLY: goal, DoD, branch, and the specific test failure output.
 */
function buildRetryPrompt(
  delegation: Delegation,
  retryN: number,
  maxRetries: number,
  testOutput: string,
): string {
  const c = delegation.contract
  const slug = (c.workItemId ?? delegation.id).replace(/[^a-z0-9-]/gi, '-').toLowerCase()
  const branch = `${c.branchStrategy ?? 'feature'}/${slug}-task`
  const dod = (c.definitionOfDone ?? [])
    .filter(Boolean)
    .map(d => `- [ ] ${d}`)
    .join('\n') || '- [ ] Task erfolgreich abgeschlossen'

  return `You are continuing work on the same task. DO NOT re-read files you already have in context.

## Task (reminder)
${c.goal}

## Branch: \`${branch}\`

## Definition of Done
${dod}

## Auto-Retry ${retryN}/${maxRetries} — Fix these test failures
Do not break passing tests. Only fix what is failing:
\`\`\`
${testOutput.slice(-2500)}
\`\`\`

Run \`npm run test:run\` to verify your fix. Then commit.`
}


function buildClaudeCliSummaryReport(fullOutput: string, elapsed: number, prUrl?: string): DelegationReport {
  const prMetadata = prUrl ? readPrMetadata(prUrl) : null
  const files = prMetadata?.files ?? []
  const filePaths = files.map(file => file.path)
  const filesAdded = files.filter(file => file.changeType === 'ADDED').map(file => file.path)
  const filesDeleted = files.filter(file => file.changeType === 'DELETED').map(file => file.path)
  const filesModified = files
    .filter(file => file.changeType !== 'ADDED' && file.changeType !== 'DELETED')
    .map(file => file.path)
  const testsPassed = parseTestsPassed(fullOutput)
  const doneLine = extractDoneLine(fullOutput)

  const keyPoints = [
    doneLine ?? 'Ausführung via Claude CLI abgeschlossen',
    prMetadata?.title ? `PR erstellt: ${prMetadata.title}` : prUrl ? 'GitHub PR erstellt' : undefined,
    filePaths.length > 0 ? `${filePaths.length} Dateien geändert` : undefined,
    testsPassed ? `${testsPassed} Tests erfolgreich` : undefined,
  ].filter(Boolean) as string[]

  return {
    keyPoints,
    changes: filePaths,
    timeTakenMinutes: elapsed,
    ...(filesAdded.length > 0 ? { filesAdded } : {}),
    ...(filesModified.length > 0 ? { filesModified } : {}),
    ...(filesDeleted.length > 0 ? { filesDeleted } : {}),
    ...(testsPassed ? { testsPassed } : {}),
    ...(prMetadata?.additions !== undefined ? { linesAdded: prMetadata.additions } : {}),
    ...(prMetadata?.deletions !== undefined ? { linesRemoved: prMetadata.deletions } : {}),
    ...(prUrl ? { prUrl, prState: 'open' as const } : {}),
    ...(prMetadata?.headRefName ? { branchName: prMetadata.headRefName } : {}),
    ...(prMetadata?.commitMessages?.length ? { commitMessages: prMetadata.commitMessages } : {}),
  }
}

interface PrMetadata {
  title?: string
  headRefName?: string
  additions?: number
  deletions?: number
  files: Array<{ path: string; changeType?: string }>
  commitMessages: string[]
}

function readPrMetadata(prUrl: string): PrMetadata | null {
  const match = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/pull\/(\d+)(?:\b|$)/.exec(prUrl.trim())
  if (!match) return null

  try {
    const [, owner, repo, number] = match
    const output = execSync(
      `gh pr view ${number} --repo ${owner}/${repo} --json title,headRefName,files,additions,deletions,commits`,
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 15_000 },
    )
    const parsed = JSON.parse(output) as {
      title?: string
      headRefName?: string
      additions?: number
      deletions?: number
      files?: Array<{ path?: string; changeType?: string }>
      commits?: Array<{ messageHeadline?: string }>
    }
    return {
      title: parsed.title,
      headRefName: parsed.headRefName,
      additions: parsed.additions,
      deletions: parsed.deletions,
      files: (parsed.files ?? [])
        .filter(file => typeof file.path === 'string' && file.path.length > 0)
        .map(file => ({ path: file.path!, changeType: file.changeType })),
      commitMessages: (parsed.commits ?? [])
        .map(commit => commit.messageHeadline)
        .filter((message): message is string => Boolean(message)),
    }
  } catch {
    return null
  }
}

function extractDoneLine(fullOutput: string): string | undefined {
  const line = fullOutput
    .split('\n')
    .map(item => item.trim())
    .find(item => item.startsWith('DONE:'))
  return line?.replace(/^DONE:\s*/i, '').trim()
}

function parseTestsPassed(fullOutput: string): number | undefined {
  const vitestMatch = /Tests?\s+(\d+)\s+passed/i.exec(fullOutput)
  if (vitestMatch) return Number(vitestMatch[1])

  const germanMatch = /(\d+)\s+gr[üu]ner?\s+Vitest-Tests/i.exec(fullOutput)
  if (germanMatch) return Number(germanMatch[1])

  const passingMatch = /(\d+)\s+passing/i.exec(fullOutput)
  if (passingMatch) return Number(passingMatch[1])

  return undefined
}

/** Read a repo/workspace's package.json scripts (undefined if missing/invalid). */
function readWorkspaceScripts(workspacePath: string): Record<string, string> | undefined {
  try {
    const pkg = JSON.parse(fsSync.readFileSync(pathMod.join(workspacePath, 'package.json'), 'utf-8')) as { scripts?: Record<string, string> }
    return pkg.scripts
  } catch {
    return undefined
  }
}

function buildPrompt(delegation: Delegation, contextCards?: MemoryCard[], retryContext?: string, targetRepo?: string): string {
  const c = delegation.contract
  const slug = (c.workItemId ?? delegation.id).replace(/[^a-z0-9-]/gi, '-').toLowerCase()
  // Unique suffix prevents branch/PR collisions when the same workItemId runs twice
  const uniq = delegation.id.replace(/-/g, '').slice(0, 6)
  const branch = `${c.branchStrategy ?? 'feature'}/${slug}-${uniq}`
  const commitPrefix = c.taskType || 'feat'
  const maxTurns = budgetToClaudeCliMaxTurns(c.maxBudgetUsd)
  const checkpointTurn = Math.max(10, Math.floor(maxTurns * 0.4))

  const dod = (c.definitionOfDone ?? [])
    .filter(Boolean)
    .map((d) => `- [ ] ${d}`)
    .join('\n') || '- [ ] Task erfolgreich abgeschlossen'

  const contextCardsBlock =
    contextCards && contextCards.length > 0
      ? `\n## Relevant Knowledge\n${contextCards.map(card => `- **${card.title}** (${card.type}): ${card.body}`).join('\n')}\n`
      : ''

  const context = c.context?.trim()
    ? `\n## Context\n${c.context.trim()}\n${contextCardsBlock}${retryContext ?? ''}`
    : `${contextCardsBlock}${retryContext ?? ''}`

  const { skillBlock, knowledgeBlock, codebaseBlock, buildingBlocksBlock, profile } = buildSelectiveContext(c, targetRepo)

  // Local target repos (a filesystem path, not a github.com URL) have no remote
  // to open a PR against — committing locally is the deliverable. ForgePilot is
  // written back automatically. Tell the agent to skip the PR step cleanly
  // instead of failing on `gh pr create` (the old "GitHub API 422" noise).
  const isLocalTarget = Boolean(targetRepo && /^[~./]/.test(targetRepo))

  // An external local target is a standalone app, NOT ForgePilot itself: don't
  // assume ForgePilot's stack/scripts — derive the verify command from the
  // target's own package.json so the agent runs scripts that actually exist.
  const verifyCmd = isLocalTarget && targetRepo
    ? verifyCommand(readWorkspaceScripts(targetRepo))
    : 'npm run test:run && npm run lint && npm run type-check'
  const intro = isLocalTarget && targetRepo
    ? `You are an autonomous software engineering agent working on the project at \`${targetRepo}\`. FIRST read its CLAUDE.md / README.md and package.json to learn its stack, scripts and conventions — do NOT assume ForgePilot's stack.`
    : 'You are an autonomous software engineering agent working on **ForgePilot** — a local-first AI Workflow OS built with Next.js 14, TypeScript strict, Tailwind CSS, and Vitest.'
  const prStep = isLocalTarget
    ? '7. Commit only: this is a LOCAL repo with no GitHub remote — do NOT run `gh pr create`. Your committed work is written back automatically.'
    : `7. PR: gh pr create --title "${commitPrefix}: ${c.goal.substring(0, 60).replace(/"/g, "'")}" --body "## Summary\\n- <bullets>\\n\\n## Test plan\\n- [ ] tests pass"`
  const smokeStep = isLocalTarget
    ? '8. Verify the app builds: npm run build (must be green) — there is no shared smoke endpoint for a standalone app.'
    : '8. Smoke-test: curl -sf http://localhost:3000/api/smoke-test | grep \'"ok":true\' || echo "ESCALATION: smoke-test failed — UI regression detected"'

  return `${intro}

## Task
${c.goal}
${context}
## Definition of Done (check each before creating PR)
${dod}

## Constraints
- Risk class: **${c.riskClass}** (A = safe/additive, B = modifies existing, C = needs human review)
- Branch: \`${branch}\`
- Max budget: $${c.maxBudgetUsd} (~${maxTurns} turns)
- Work item: ${c.workItemId}
- Context profile: **${profile}** (token-optimized for ${profile} tasks)

## Execution protocol (follow exactly, in order)
\`\`\`
1. Read CLAUDE.md  →  understand conventions and project structure
2. git checkout -b ${branch}
3. Explore: read relevant source files before writing any code
4. Implement: small, focused changes — one concern per commit
5. Verify: ${verifyCmd}
   (run type-check BEFORE build — never in parallel)
6. Commit: git commit -m "${commitPrefix}: <description>"
${prStep}
${smokeStep}
9. Final output: print DONE: <one-sentence summary>
\`\`\`

## Anti-drift rules (critical — read before each major action)
- **Stay in scope**: only modify files directly needed for this task. Touching unrelated files = scope drift.
- **No gold-plating**: implement exactly what the Definition of Done requires. Nothing more.
- **Turn checkpoint**: at turn ${checkpointTurn}, stop and re-read "## Task" and "## Definition of Done" above before continuing.
- **Progress signal every 10 turns**: print "PROGRESS: <what done> | <what next> | <turns used>/${maxTurns}"
- **Budget gate**: if this cannot be completed safely inside $${c.maxBudgetUsd}, stop before widening scope and print "ESCALATION: budget-risk — <smallest next slice>".
- **Abort conditions** — stop immediately and print "ESCALATION: <reason>" if:
  - You've used more than 60% of turns without a commit
  - A step fails 3 times with the same error
  - The task requires touching Risk-C files and riskClass is A or B
  - You are unsure which of 2+ approaches to take

## Quality rules
- No \`any\` types. No unused imports. No comments stating the obvious.
- Tests must cover the new behavior — not just type-check.
- Never commit directly to main. Never force-push.
- If a step fails, diagnose root cause before retrying.

## Token efficiency (follow strictly to keep costs low)
- **Never re-read a file you already have in context** — use what you read.
- **One WebFetch attempt per URL** — if it fails (4xx/5xx), try a different approach.
- **Diagnose before retrying commands** — read error output fully before repeating.
- **Config files stay in context** — never reload tsconfig.json, package.json twice.
${skillBlock}${knowledgeBlock}${codebaseBlock}${buildingBlocksBlock}

Start now.`
}

// buildSubTaskPrompt is imported from @/lib/delegation-execution

type SkillCategory = NonNullable<import('@/lib/models/delegation').TaskContract['skillCategory']>

/**
 * Detect credit/auth errors in claude CLI output.
 * Returns a user-friendly message or undefined if no known error.
 */
// detectKnownError and classifyError are imported from @/lib/runner-health/error-classifier
// This keeps the execute route using a shared, testable classifier.

function isClaudeCliFallbackError(message: string | undefined): boolean {
  if (!message) return false
  const lower = message.toLowerCase()
  return lower.includes('api key')
    || lower.includes('anthropic')
    || lower.includes('authentication')
    || lower.includes('rate limit')
    || lower.includes('rate-limit')
}

function alreadyAttemptedCodexFallback(delegation: Delegation): boolean {
  return (delegation.logs ?? []).some(log => log.message.includes('Fallback auf Codex CLI'))
}

function isCodexFallbackReady(): boolean {
  try {
    const readiness = getRunnerReadiness({
      deep: true,
      cwd: process.cwd(),
      timeoutMs: 30_000,
    })
    writeCachedRunnerReadiness(readiness)
    return readiness.codex.headlessReady
  } catch {
    return false
  }
}

/**
 * Parse actual cost from Claude CLI output.
 * Claude outputs something like: "Cost: $0.0234" or "Total cost: $0.01"
 */
function parseCostFromOutput(output: string): number | undefined {
  // Pattern: "Cost: $X.XXXX" or "Total cost: $X.XX" or "cost: $X"
  const patterns = [
    /total cost[:\s]+\$([0-9]+(?:\.[0-9]+)?)/i,
    /cost[:\s]+\$([0-9]+(?:\.[0-9]+)?)/i,
    /\$([0-9]+\.[0-9]{2,4})\s*(?:USD|usd)?(?:\s|$)/,
  ]
  for (const pattern of patterns) {
    const match = pattern.exec(output)
    if (match) {
      const val = parseFloat(match[1])
      if (!isNaN(val) && val > 0 && val < 100) return val
    }
  }
  return undefined
}

/**
 * Parse a GitHub PR URL from claude CLI output.
 * gh pr create prints the URL on its own line when successful.
 */
function parsePrUrlFromOutput(output: string): string | undefined {
  const match = /https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/\d+/i.exec(output)
  return match ? match[0] : undefined
}

/**
 * After a successful agent run, detect uncommitted git changes and open a PR.
 * Used for runners that don't natively create PRs (e.g. Ollama).
 * Returns the PR URL if created, undefined otherwise.
 */
function tryCreatePrFromGitChanges(options: {
  workdir: string
  branchName: string
  commitMessage: string
  prTitle: string
  prBody: string
  delegationId: string
}): string | undefined {
  const { workdir, branchName, commitMessage, prTitle, prBody, delegationId } = options
  try {
    const status = execSync('git status --porcelain', { cwd: workdir, encoding: 'utf8', timeout: 5000 }).trim()
    if (!status) {
      delegationLogger.info({ event: 'pr.skip.no_changes', delegationId }, 'No git changes detected — skipping auto-PR')
      return undefined
    }
    const safeBranch = branchName.replace(/[^a-zA-Z0-9._/-]/g, '-').slice(0, 80)
    execSync(`git checkout -b ${safeBranch}`, { cwd: workdir, stdio: 'ignore', timeout: 5000 })
    execSync('git add -A', { cwd: workdir, stdio: 'ignore', timeout: 10000 })
    execSync(`git commit -m ${JSON.stringify(commitMessage)}`, { cwd: workdir, stdio: 'ignore', timeout: 10000 })
    execSync(`git push origin ${safeBranch}`, { cwd: workdir, stdio: 'ignore', timeout: 30000 })
    const prUrl = execSync(
      `gh pr create --title ${JSON.stringify(prTitle)} --body ${JSON.stringify(prBody)}`,
      { cwd: workdir, encoding: 'utf8', timeout: 30000 },
    ).trim()
    const url = parsePrUrlFromOutput(prUrl) ?? prUrl
    delegationLogger.info({ event: 'pr.created', url, delegationId }, 'Auto-PR created after Ollama run')
    return url
  } catch (err) {
    delegationLogger.warn({ event: 'pr.create.failed', error: String(err), delegationId }, 'Auto-PR creation failed')
    return undefined
  }
}

/**
 * M217: Auto-merge PR for Risk A delegations.
 * Risk A = safe/additive → auto-merge when CI passes.
 * Risk B = modifies existing → manual review needed.
 * Risk C = blocked upstream at approval step.
 */
async function autoMergePRIfEligible(prUrl: string, delegation: Delegation): Promise<void> {
  if (delegation.contract.riskClass !== 'A') return
  try {
    const match = /\/pull\/(\d+)/.exec(prUrl)
    if (!match) return
    const prNumber = Number(match[1])
    if (!Number.isInteger(prNumber) || prNumber <= 0) return

    const configs = readConnectorConfigs()
    const config = configs.github ?? {}
    const preview = await getGitHubPullRequestPreview(config, prNumber)
    const safety = evaluateMergeSafety(preview, { delegation, mode: 'auto' })

    if (safety.status !== 'ready') {
      delegationLogger.info(
        { event: 'pr.auto_merge.skipped', prUrl, delegationId: delegation.id, reasons: safety.reasons },
        'Auto-merge skipped by safety gate',
      )
      return
    }

    const result = await mergeGitHubPullRequest(config, {
      number: prNumber,
      sha: preview.headSha,
      title: preview.title,
      message: 'Auto-merged by ForgePilot after Risk A safety gate passed.',
    })

    if (result.merged) {
      const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
      const latest = await repo.findById(delegation.id)
      if (latest) {
        await repo.update(delegation.id, {
          summaryReport: {
            ...(latest.summaryReport ?? { keyPoints: [], changes: [], timeTakenMinutes: 0 }),
            prUrl,
            prState: 'merged',
            prMergedAt: new Date().toISOString(),
          },
        })
      }
      delegationLogger.info(
        { event: 'pr.auto_merge.merged', prUrl, delegationId: delegation.id, sha: result.sha },
        'Auto-merge completed after safety gate passed',
      )
    }
  } catch (err) {
    delegationLogger.warn(
      { event: 'pr.auto_merge.failed', error: String(err), prUrl, delegationId: delegation.id },
      'Auto-merge failed after safety gate',
    )
  }
}

function runWithClaudeCLI(id: string, prompt: string, startTime: Date, budgetUsd: number, riskClass: string, targetRepo?: string, existingWorkspace?: RunnerWorkspace, scaffold?: { goal: string; context: string }) {
  const storedKeys = readStoredApiKeys()
  const anthropicKey = storedKeys.ANTHROPIC_API_KEY?.trim() || undefined
  const maxTurns = budgetToClaudeCliMaxTurns(budgetUsd)

  // Strip ANTHROPIC_API_KEY from inherited env so Claude CLI uses its own
  // session auth (Max subscription). Only re-inject if a key is explicitly
  // configured via the Settings UI — that key takes precedence.
  const { ANTHROPIC_API_KEY: _stripped, ...baseEnv } = process.env
  // Ensure GH_TOKEN reaches the subprocess so agents can run `gh pr create`
  const ghToken = storedKeys.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim()
  const childEnv = {
    ...baseEnv,
    ...(anthropicKey ? { ANTHROPIC_API_KEY: anthropicKey } : {}),
    ...(ghToken ? { GH_TOKEN: ghToken, GITHUB_TOKEN: ghToken } : {}),
  }

  let runnerWorkspace: RunnerWorkspace
  try {
    runnerWorkspace = prepareRunnerWorkspace({ delegationId: id, targetRepo, existingWorkspace })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    void appendLogs(id, [{
      timestamp: new Date().toISOString(),
      type: 'error',
      message: `❌ Runner-Workspace konnte nicht vorbereitet werden: ${msg}`,
    }], 'failed')
    upsertAttentionItem({
      id: `completion:${id}`,
      type: 'delegation_failed',
      severity: 'critical',
      title: '❌ Runner-Workspace fehlgeschlagen',
      body: msg.slice(0, 200),
      delegationId: id,
      actionUrl: `/delegations/${id}`,
      createdAt: new Date().toISOString(),
    })
    return
  }

  void appendLogs(id, [{
    timestamp: new Date().toISOString(),
    type: 'info',
    message: `Runner-Workspace vorbereitet: ${runnerWorkspace.path}`,
  }])

  // Pre-scaffold a fresh workspace with the FOUNDATION blocks — copies vetted
  // test + app-shell (+ landing) files with ZERO tokens so the agent only writes
  // app-specific code. Guarded to fresh repos (no package.json) and first runs.
  //
  // ON by default (opt out with FORGEPILOT_PRESCAFFOLD=false). The full-bundle
  // scaffold cost +18%, but the foundation-only scaffold measured CHEAPER than
  // no scaffold ($2.99 vs $3.16) and -35% vs the full one. See finding memo.
  if (scaffold && targetRepo && !existingWorkspace && process.env.FORGEPILOT_PRESCAFFOLD !== 'false') {
    try {
      const result = autoScaffoldWorkspace({
        workspacePath: runnerWorkspace.path,
        goal: scaffold.goal,
        context: scaffold.context,
        resolveBlockIds: scopedScaffoldBlockIds,
      })
      if (result.scaffolded) {
        void appendLogs(id, [{
          timestamp: new Date().toISOString(),
          type: 'success',
          message: `🧱 Pre-Scaffold: ${result.fileCount} Dateien (${result.reason}) ohne Tokens kopiert — Agent baut nur App-Spezifisches.`,
        }])
      }
    } catch { /* pre-scaffold is best-effort */ }
  }

  const proc = spawn(
    'claude',
    ['-p', prompt, '--dangerously-skip-permissions', '--max-turns', String(maxTurns), '--output-format', 'stream-json', '--verbose'],
    {
      cwd: runnerWorkspace.path,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...childEnv,
        FORGEPILOT_RUNNER_WORKTREE: runnerWorkspace.path,
      },
    },
  )
  proc.unref()

  // Register PID for cancellation
  if (proc.pid) {
    registerProcess(id, proc.pid)
  }

  const logBuffer: AgentLog[] = []
  let fullOutput = ''
  let stdoutBuffer = ''
  let flushTimer: ReturnType<typeof setTimeout> | null = null
  let startupTimer: ReturnType<typeof setTimeout> | null = null
  let sawOutput = false

  const startupTimeoutMs = Math.max(
    30_000,
    Number(process.env.FORGEPILOT_CLI_STARTUP_TIMEOUT_MS ?? 180_000),
  )

  const clearStartupTimer = () => {
    if (startupTimer) {
      clearTimeout(startupTimer)
      startupTimer = null
    }
  }

  const scheduleFlush = () => {
    if (flushTimer) clearTimeout(flushTimer)
    flushTimer = setTimeout(() => {
      if (logBuffer.length > 0) {
        appendLogs(id, [...logBuffer])
        logBuffer.length = 0
      }
    }, 2000)
  }

  startupTimer = setTimeout(() => {
    if (sawOutput) return
    const timeoutSeconds = Math.round(startupTimeoutMs / 1000)
    const message = [
      `Claude CLI hat nach ${timeoutSeconds}s keine Ausgabe geliefert.`,
      'Moegliche Ursache: CLI-Login/OAuth wartet interaktiv, Netzwerk blockiert oder Headless-Modus haengt.',
      'Bitte Claude CLI lokal mit `claude -p "ping" --max-turns 1` testen und danach erneut starten.',
    ].join(' ')
    void appendLogs(id, [{
      timestamp: new Date().toISOString(),
      type: 'error',
      message,
    }], 'failed') // set terminal status — otherwise the delegation hangs on 'running' forever
    createDelegationRepository(SINGLE_TENANT_USER_ID)
      .update(id, { errorMessage: message, completedAt: new Date().toISOString() })
      .catch(() => {})
    try {
      if (proc.pid) process.kill(-proc.pid, 'SIGTERM')
    } catch {
      proc.kill('SIGTERM')
    }
  }, startupTimeoutMs)

  // Summarise a tool input into a human-readable one-liner
  function summariseTool(name: string, input: Record<string, unknown>): string {
    switch (name) {
      case 'Bash': {
        const cmd = String(input.command ?? '').replace(/\s+/g, ' ').trim()
        return `$ ${cmd.slice(0, 120)}`
      }
      case 'Read':   return `📖 ${input.file_path ?? input.path ?? ''}`
      case 'Edit':   return `✏️  ${input.file_path ?? ''} — ${String(input.old_string ?? '').slice(0, 60).replace(/\n/g, '↵')}…`
      case 'Write':  return `💾 ${input.file_path ?? ''}`
      case 'WebFetch': return `🌐 ${input.url ?? ''}`
      case 'WebSearch': return `🔍 ${input.query ?? ''}`
      case 'TodoWrite':
      case 'TodoRead': return `📋 ${name}`
      default:       return `🔧 ${name}(${Object.keys(input).join(', ')})`
    }
  }

  // Parse one complete NDJSON line from stream-json output
  function parseStreamLine(line: string): void {
    let event: Record<string, unknown>
    try { event = JSON.parse(line) } catch { return }

    const type = event.type as string

    if (type === 'assistant') {
      const msg = event.message as { content?: Array<{ type: string; text?: string; name?: string; input?: Record<string, unknown> }> }
      for (const block of msg?.content ?? []) {
        if (block.type === 'text' && block.text?.trim()) {
          const text = block.text.trim()
          logBuffer.push({ timestamp: new Date().toISOString(), type: 'thought', message: text.slice(0, 500) })

          // M109: Checkpoint detection — agent prints "CHECKPOINT: <phase>"
          // Guard: skip if a test run is already in progress (concurrent CHECKPOINTs).
          if (text.startsWith('CHECKPOINT:') && !checkpointTestRunning) {
            const phase = text.slice('CHECKPOINT:'.length).trim()
            checkpointTestRunning = true
            logBuffer.push({ timestamp: new Date().toISOString(), type: 'info', message: `🔖 Checkpoint: ${phase} — Tests laufen…` })
            scheduleFlush()
            runPostExecutionTestsAsync(runnerWorkspace.path).then(testResult => {
              checkpointTestRunning = false
              return appendLogs(id, [{
                timestamp: new Date().toISOString(),
                type: testResult.passed ? 'info' : 'error',
                message: testResult.passed
                  ? `✅ Checkpoint bestanden: ${phase}`
                  : `❌ Checkpoint-Tests fehlgeschlagen: ${phase} — Agent läuft weiter`,
              }])
            }).catch(() => { checkpointTestRunning = false })
          }
        } else if (block.type === 'tool_use' && block.name) {
          const summary = summariseTool(block.name, block.input ?? {})
          logBuffer.push({ timestamp: new Date().toISOString(), type: 'command', message: summary })
        }
      }
      scheduleFlush()
    } else if (type === 'tool_result') {
      // Show tool output briefly (first non-empty line, max 200 chars)
      const content = event.content as Array<{ type: string; text?: string }> | undefined
      const text = content?.find(c => c.type === 'text')?.text?.trim()
      if (text) {
        const firstLine = text.split('\n').find(l => l.trim()) ?? ''
        if (firstLine) {
          logBuffer.push({ timestamp: new Date().toISOString(), type: 'info', message: firstLine.slice(0, 200) })
          scheduleFlush()
        }
      }
    } else if (type === 'result') {
      // Extract cost + token counts from the result event
      const cost = event.total_cost_usd as number | undefined
      if (cost != null) fullOutput += `\nCost: $${cost.toFixed(4)}`

      // Token tracking — Claude CLI stream-json includes usage in result event
      const usage = event.usage as { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number } | undefined
      if (usage) {
        const inp = usage.input_tokens ?? 0
        const out = usage.output_tokens ?? 0
        const cached = usage.cache_read_input_tokens ?? 0
        fullOutput += `\nTokens: ${inp} in / ${out} out${cached ? ` / ${cached} cached` : ''}`
        // Store on delegation for analytics (non-blocking update)
        if (inp > 0 || out > 0) {
          createDelegationRepository(SINGLE_TENANT_USER_ID).update(id, {
            inputTokens: inp,
            outputTokens: out,
            cachedTokens: cached,
          }).catch(() => {})
        }
      }
    }
  }

  // M107/M109: Async test runner — used both during checkpoints and post-execution.
  // Guard against concurrent runs: if a test is already running for this workspace, skip.
  let checkpointTestRunning = false
  function runPostExecutionTestsAsync(workspacePath: string): Promise<{ passed: boolean; output: string; timedOut?: boolean; skipped?: boolean }> {
    const testScript = resolveVerifyScripts(readWorkspaceScripts(workspacePath)).test
    if (!testScript) return Promise.resolve({ passed: true, output: 'kein Test-Script — übersprungen', skipped: true })
    return new Promise(resolve => {
      const child = spawn('npm', ['run', testScript], { cwd: workspacePath, stdio: ['ignore', 'pipe', 'pipe'] })
      let out = ''
      child.stdout?.on('data', (chunk: Buffer) => { out += chunk.toString() })
      child.stderr?.on('data', (chunk: Buffer) => { out += chunk.toString() })
      // 300s: full suite in a fresh worktree takes 2-4 min (collect + 3500+ tests).
      // A timeout is an INFRA signal (slow machine, npm install missing) — never a code-failure.
      const timer = setTimeout(() => {
        child.kill()
        resolve({ passed: false, output: 'Test runner timed out after 300s', timedOut: true })
      }, 300_000)
      child.on('close', (code: number | null) => {
        clearTimeout(timer)
        resolve({ passed: code === 0, output: out.slice(-3000) })
      })
    })
  }

  // Build-Gate: a phase must produce a green `npm run build` before the next
  // chain phase may start — otherwise broken foundations cascade.
  // Skips gracefully if the workspace has no build script (returns passed=true).
  function runBuildGateAsync(workspacePath: string): Promise<{ passed: boolean; output: string; skipped?: boolean }> {
    return new Promise(resolve => {
      let hasBuild = false
      try {
        const pkg = JSON.parse(fsSync.readFileSync(pathMod.join(workspacePath, 'package.json'), 'utf-8')) as { scripts?: Record<string, string> }
        hasBuild = Boolean(pkg.scripts?.build)
      } catch { /* no package.json yet */ }
      if (!hasBuild) { resolve({ passed: true, output: 'kein build-Script — Gate übersprungen', skipped: true }); return }

      const child = spawn('npm', ['run', 'build'], {
        cwd: workspacePath,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'production' },
      })
      let out = ''
      child.stdout?.on('data', (c: Buffer) => { out += c.toString() })
      child.stderr?.on('data', (c: Buffer) => { out += c.toString() })
      const timer = setTimeout(() => { child.kill(); resolve({ passed: false, output: 'Build-Timeout nach 300s' }) }, 300_000)
      child.on('close', (code: number | null) => {
        clearTimeout(timer)
        resolve({ passed: code === 0, output: out.slice(-3000) })
      })
    })
  }

  // Test-Gate: after a green build, a phase must also pass `npm run test:run`
  // before the next chain phase starts. Skips gracefully when there is no
  // test:run script. A timeout is an infra signal (handled by decidePhaseGate).
  function runTestGateAsync(workspacePath: string): Promise<{ passed: boolean; output: string; timedOut?: boolean; skipped?: boolean }> {
    // runPostExecutionTestsAsync resolves the repo's real test script
    // (test:run ?? test ?? …) and skips gracefully when there is none.
    return runPostExecutionTestsAsync(workspacePath)
  }

  proc.stdout?.on('data', (chunk: Buffer) => {
    sawOutput = true
    clearStartupTimer()
    stdoutBuffer += chunk.toString()
    // Process complete NDJSON lines
    const lines = stdoutBuffer.split('\n')
    stdoutBuffer = lines.pop() ?? '' // keep incomplete last line
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      fullOutput += trimmed + '\n'
      parseStreamLine(trimmed)
    }
  })

  proc.stderr?.on('data', (chunk: Buffer) => {
    sawOutput = true
    clearStartupTimer()
    const text = chunk.toString()
    fullOutput += text
    const knownError = detectKnownError(text)
    const lines = text.split('\n').filter(l => l.trim())
    for (const line of lines) {
      logBuffer.push({
        timestamp: new Date().toISOString(),
        type: 'error',
        message: line.substring(0, 500),
      })
    }
    if (knownError) {
      logBuffer.push({
        timestamp: new Date().toISOString(),
        type: 'error',
        message: `⚠️ ${knownError}`,
      })
    }
    scheduleFlush()
  })

  proc.on('close', (code: number | null) => {
    if (flushTimer) clearTimeout(flushTimer)
    clearStartupTimer()
    unregisterProcess(id)

    const success = code === 0
    const elapsed = Math.round((Date.now() - startTime.getTime()) / 60000)
    const actualCost = parseCostFromOutput(fullOutput)
    const prUrl = parsePrUrlFromOutput(fullOutput)
    const knownError = !success ? detectKnownError(fullOutput) : undefined

    const autoMergeNote = success && prUrl
      ? riskClass === 'A'
        ? ' · Auto-Merge wird per Safety-Gate geprüft (Risk A)'
        : riskClass === 'B'
          ? ' · PR bereit — Review erforderlich (Risk B)'
          : ''
      : ''

    const finalLog: AgentLog = {
      timestamp: new Date().toISOString(),
      type: success ? 'success' : 'error',
      message: success
        ? `✅ Ausführung abgeschlossen (Exit-Code: ${code}${actualCost ? `, Kosten: $${actualCost.toFixed(4)}` : ''}${autoMergeNote})`
        : knownError
          ? `❌ ${knownError}`
          : `❌ Ausführung fehlgeschlagen (Exit-Code: ${code})`,
    }

    const report: DelegationReport | undefined = success
      ? buildClaudeCliSummaryReport(fullOutput, elapsed, prUrl)
      : undefined

    const cleanupRunnerWorkspace = async () => {
      // Persistent multi-phase build: if this delegation has a NEXT chain phase,
      // keep the workspace alive so the next phase builds on this one's work.
      // Only the LAST phase writes back to the target repo + cleans up.
      const _chainState = await createDelegationRepository(SINGLE_TENANT_USER_ID).findById(id).catch(() => null)
      const hasNextPhase = Boolean(_chainState?.chainNextId)
      if (success && hasNextPhase) {
        // Keep the workspace alive for the next phase. The Build-Gate already ran
        // (before triggerChain) and confirmed this phase builds — see below.
        await createDelegationRepository(SINGLE_TENANT_USER_ID)
          .update(id, { worktreePath: runnerWorkspace.path })
          .catch(() => {})
        await appendLogs(id, [{
          timestamp: new Date().toISOString(),
          type: 'info',
          message: `⛓️ Workspace bleibt erhalten für die nächste Phase: ${runnerWorkspace.path}`,
        }])
        return // do NOT writeback or clean up — the next phase continues here
      }

      // Writeback + outcome verification: for a LOCAL target repo, push the agent's
      // result back BEFORE the temp clone is deleted — otherwise the code is lost.
      if (success && targetRepo) {
        const writeback = writebackLocalResult({
          workspacePath: runnerWorkspace.path,
          targetRepo,
          delegationId: id,
        })
        if (writeback) {
          if (writeback.mergedToMain) {
            await appendLogs(id, [{
              timestamp: new Date().toISOString(),
              type: 'success',
              message: `✅ Ergebnis autonom in ${targetRepo} (${writeback.defaultBranch}) übernommen — ${writeback.fileCount} Dateien.${writeback.installed ? ' Abhängigkeiten installiert (npm install) — sofort startklar.' : ''} Backup-Branch: ${writeback.branch}`,
            }])
            // Runtime-Bootstrap: make the merged app actually runnable (env + DB),
            // not just compilable. Best-effort — never fails the delegation.
            try {
              const bootstrap = bootstrapRuntime({ targetRepo })
              const summary = summarizeBootstrap(bootstrap)
              if (summary !== 'Kein Runtime-Bootstrap nötig') {
                await appendLogs(id, [{
                  timestamp: new Date().toISOString(),
                  type: 'info',
                  message: `🚀 Runtime-Bootstrap: ${summary}`,
                }])
              }
              // Live smoke test: prove the app actually BOOTS, not just compiles.
              const smoke = await smokeTestApp({ targetRepo })
              if (smoke.ran) {
                await appendLogs(id, [{
                  timestamp: new Date().toISOString(),
                  type: smoke.ok ? 'success' : 'error',
                  message: `${smoke.ok ? '🟢' : '🔴'} Smoke-Test: ${smoke.detail}`,
                }])
              }
            } catch { /* bootstrap + smoke are best-effort */ }
          } else {
            await appendLogs(id, [{
              timestamp: new Date().toISOString(),
              type: 'info',
              message: `⚠ Auto-Merge nicht möglich (${writeback.defaultBranch} divergiert). Ergebnis liegt im Branch \`${writeback.branch}\` (${writeback.fileCount} Dateien). Mergen mit: git merge ${writeback.branch}`,
            }])
          }
          // Outcome verification: a "completed" build that wrote almost nothing is suspect
          if (writeback.fileCount <= 1) {
            await appendLogs(id, [{
              timestamp: new Date().toISOString(),
              type: 'error',
              message: `❌ Outcome-Warnung: Der Lauf meldete Erfolg, aber das Ergebnis enthält nur ${writeback.fileCount} Datei(en). Der Agent hat vermutlich nichts Substanzielles erzeugt.`,
            }])
            await createDelegationRepository(SINGLE_TENANT_USER_ID)
              .update(id, { errorMessage: `Outcome-Verifikation fehlgeschlagen: nur ${writeback.fileCount} Datei(en) im Ergebnis` })
              .catch(() => {})
          }
        } else {
          await appendLogs(id, [{
            timestamp: new Date().toISOString(),
            type: 'error',
            message: `❌ Writeback fehlgeschlagen — Code konnte nicht ins Ziel-Repo ${targetRepo} geschrieben werden. Bitte Logs prüfen.`,
          }])
        }
      }
      if (shouldKeepRunnerWorktree({ success, env: process.env })) {
        // M120: Store workspace path in delegation for preview access
        const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
        await repo.update(id, { worktreePath: runnerWorkspace.path }).catch(() => {})
        await appendLogs(id, [{
          timestamp: new Date().toISOString(),
          type: success ? 'info' : 'error',
          message: success
            ? `Runner-Workspace behalten: ${runnerWorkspace.path}`
            : `Runner-Workspace nach Fehler behalten: ${runnerWorkspace.path}`,
        }])
        delegationLogger.info(
          {
            event: 'delegation.runner_workspace_kept',
            delegationId: id,
            success,
            workspacePath: runnerWorkspace.path,
          },
          'Runner workspace retained',
        )
        return
      }

      try {
        runnerWorkspace.cleanup()
      } catch (cleanupError) {
        delegationLogger.warn(
          {
            event: 'delegation.runner_workspace_cleanup_failed',
            delegationId: id,
            error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
            workspacePath: runnerWorkspace.path,
          },
          'Runner workspace cleanup failed',
        )
      }
    }

    // Only update if still running (not already cancelled)
    void (async () => {
      try {
      const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
      const current = await repo.findById(id)
      if (!current || current.status !== 'running') return

      // M107: Post-execution test verification + auto-retry (max 3 attempts)
      const autoRetryEnabled = true
      const currentRetryCount = current.retryCount ?? 0
      if (success && autoRetryEnabled && currentRetryCount < 3) {
        const testResult = await runPostExecutionTestsAsync(runnerWorkspace.path)
        if (testResult.timedOut) {
          // Infra problem, not a code problem — do NOT burn a retry on it
          void appendLogs(id, [{
            timestamp: new Date().toISOString(),
            type: 'info',
            message: '⚠ Test-Runner-Timeout (Infra) — kein Auto-Retry, Lauf wird als abgeschlossen gewertet. Tests bitte manuell prüfen.',
          }])
        } else if (!testResult.passed) {
          void appendLogs(id, [{
            timestamp: new Date().toISOString(),
            type: 'error',
            message: `🔄 Auto-Retry ${currentRetryCount + 1}/3 — Tests fehlgeschlagen:\n${testResult.output.slice(0, 600)}`,
          }])
          await repo.update(id, { retryCount: currentRetryCount + 1 })
          // Use compact retry prompt — saves ~70% tokens vs repeating full original prompt
          const retryPrompt = buildRetryPrompt(current, currentRetryCount + 1, 3, testResult.output)
          runWithClaudeCLI(id, retryPrompt, startTime, budgetUsd, riskClass, targetRepo, runnerWorkspace)
          return // Don't cleanup the workspace — the retry run will handle it
        }
      }

      if (!success && isClaudeCliFallbackError(knownError) && !alreadyAttemptedCodexFallback(current)) {
        if (isCodexFallbackReady()) {
          const fallbackLog: AgentLog = {
            timestamp: new Date().toISOString(),
            type: 'info',
            message: `Fallback auf Codex CLI: Claude CLI blockiert (${knownError}).`,
          }
          await repo.update(id, {
            errorMessage: undefined,
            logs: [...(current.logs ?? []), ...logBuffer, finalLog, fallbackLog],
          })
          await cleanupRunnerWorkspace()
          runWithCodexCLI(id, prompt, new Date(), budgetUsd, riskClass, targetRepo)
          return
        }

        await appendLogs(id, [{
          timestamp: new Date().toISOString(),
          type: 'error',
          message: 'Codex CLI Fallback nicht bereit. Bitte Codex CLI lokal anmelden oder in Settings pruefen.',
        }])
      }

      const finalStatus = success ? 'completed' : 'failed'
      // M4: Use full classifier for rich error message
      const classifiedFailure = !success ? classifyError(fullOutput) : null
      const friendlyError = classifiedFailure && classifiedFailure.category !== 'unknown'
        ? `${classifiedFailure.title} — ${classifiedFailure.fix}`
        : knownError ?? (code !== 0 ? `Prozess beendet mit Exit-Code ${code ?? 'unbekannt'}` : undefined)

      const finishedDelegation = await repo.update(id, {
        status: finalStatus,
        completedAt: new Date().toISOString(),
        ...(!success
          ? { errorMessage: friendlyError }
          : {}),
        ...(actualCost ? { actualCostUsd: actualCost } : {}),
        ...(report ? { summaryReport: report } : {}),
        logs: [...(current.logs ?? []), ...logBuffer, finalLog],
      })
      if (!finishedDelegation) return

      recordRuntimeExecuteLoopEvidence(finishedDelegation, {
        blocker: success ? undefined : knownError ?? `Exit-Code: ${code}`,
        notes: success
          ? 'Execution evidence recorded after runner reached completed state.'
          : 'Execution evidence recorded after runner failed.',
      })

      // M209: Post-execution budget guard — mark failed if actual cost exceeded limit
      if (success && actualCost) {
        const budgetResult = await checkBudget(finishedDelegation)
        if (budgetResult.exceeded) {
          // Delegation already marked as failed by checkBudget — skip further processing
          return
        }
      }

      // M207: Fan-in — notify parent if this is a parallel sub-delegation
      void checkParallelCompletion(finishedDelegation)

      // M230: Delegation chaining — gated on a green build for multi-phase builds.
      // The next phase must NOT start on a broken foundation.
      if (success) {
        if (finishedDelegation.chainNextId) {
          // Gate the next phase on a green build AND green tests — a phase must
          // not start on a broken foundation. Test timeouts are an infra signal.
          const buildGate = await runBuildGateAsync(runnerWorkspace.path)
          const testGate = buildGate.passed
            ? await runTestGateAsync(runnerWorkspace.path)
            : { passed: false, output: '', skipped: true }
          const decision = decidePhaseGate({
            buildPassed: buildGate.passed,
            buildSkipped: buildGate.skipped,
            testPassed: testGate.passed,
            testTimedOut: testGate.timedOut,
            testSkipped: testGate.skipped,
          })
          if (!decision.proceed) {
            const failOutput = (buildGate.passed ? testGate.output : buildGate.output).slice(-800)
            await appendLogs(id, [{
              timestamp: new Date().toISOString(),
              type: 'error',
              message: `⛔ ${decision.reason} Nächste Phase wird NICHT gestartet.\n${failOutput}`,
            }], 'failed')
            await repo.update(id, {
              errorMessage: decision.reason,
              chainNextId: undefined,
            }).catch(() => {})
          } else {
            if (!(buildGate.skipped && testGate.skipped)) {
              await appendLogs(id, [{ timestamp: new Date().toISOString(), type: 'success', message: `✅ ${decision.reason}` }])
            }
            void triggerChain(finishedDelegation, fullOutput).catch(() => {})
          }
        } else {
          void triggerChain(finishedDelegation, fullOutput).catch(() => {})
        }
      }

      // Loop-Closure: in autopilot mode, auto-start the next safe delegation
      // after a successful completion (fills the gap between chain steps)
      try {
        const config = getNBAConfig()
        if (success && config.approvalMode === 'autopilot' && !finishedDelegation.chainNextId) {
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
          fetch(`${baseUrl}/api/delegations/next-safe`, { method: 'POST' }).catch(() => {})
        }
      } catch { /* non-critical */ }

      {

      // Record quality outcome in skill-history (feeds Performance tab)
      try {
        const skillCategory = (finishedDelegation.contract.skillCategory ?? 'refactor') as SkillCategory
        const warnings = finishedDelegation.summaryReport?.warnings ?? []
        const typeErrors = warnings.filter(w => w.toLowerCase().includes('type error') || w.toLowerCase().includes('typescript')).length
        const lintErrors = warnings.filter(w => w.toLowerCase().includes('lint')).length
        const filesChanged = (finishedDelegation.summaryReport?.filesModified?.length ?? 0)
          + (finishedDelegation.summaryReport?.filesAdded?.length ?? 0)
        const durationMinutes = finishedDelegation.summaryReport?.timeTakenMinutes ?? elapsed
        const testsPassed = (finishedDelegation.summaryReport?.testsPassed ?? 1) > 0

        const result = scoreWork({
          task: {
            id: finishedDelegation.id,
            title: finishedDelegation.title ?? finishedDelegation.contract.goal.slice(0, 60),
            description: finishedDelegation.contract.goal,
            acceptanceCriteria: finishedDelegation.contract.definitionOfDone ?? [],
            skillCategory,
            assignedAgentType: 'claude-code',
            filePatterns: finishedDelegation.contract.allowedFilePatterns ?? [],
            effort: 'M',
            dependsOn: [],
            order: 0,
          },
          // Use process exit success as primary quality signal
          testsPassed: success && testsPassed,
          typeErrorCount: typeErrors,
          lintErrorCount: lintErrors,
          filesChanged,
          retryCount: 0,
          durationMinutes,
        })
        recordOutcome('claude-code', skillCategory, result)

        // Record outcomes for all global skills — feeds the self-improving optimizer
        try {
          seedBuiltinSkills()
          const globalSkills = listSkills({ scope: 'global', status: 'active' })
          const now = new Date().toISOString()
          for (const skill of globalSkills) {
            recordSkillOutcome({
              skillId: skill.id,
              qualityScore: result.qualityScore,
              tokensSaved: 0,
              success,
              recordedAt: now,
            })
          }
          // Auto-optimize every 10 completed runs
          const totalRuns = globalSkills.reduce((sum, s) => sum + s.metrics.runsCount, 0)
          if (globalSkills.length > 0 && totalRuns > 0 && totalRuns % 10 === 0) {
            applyAutoOptimizations(85)
          }
        } catch {
          // Non-critical telemetry — never break execution
        }
      } catch {
        // Non-critical — never break execution due to telemetry
      }

      // Linear writeback — fire-and-forget
      if (success && report) {
        postLinearCompletionComment(finishedDelegation).catch(() => {})
      }

      // M197: Auto-PR creation — fire-and-forget
      if (success) {
        void createGitHubPRIfNeeded(finishedDelegation, fullOutput).then(async (result) => {
          const prLog: AgentLog = {
            timestamp: new Date().toISOString(),
            type: result.prUrl ? 'success' : 'info',
            message: result.prUrl
              ? `🔗 GitHub PR bereit: ${result.prUrl}${result.reason === 'already_exists' ? ' (bereits vorhanden)' : ''}`
              : `⚠️ GitHub PR nicht erstellt: ${result.reason ?? 'unbekannter Grund'}`,
          }
          await appendLogs(finishedDelegation.id, [prLog])

          if (result.prUrl) {
            const prRepo = createDelegationRepository(SINGLE_TENANT_USER_ID)
            const updated = await prRepo.update(finishedDelegation.id, {
              summaryReport: {
                keyPoints: finishedDelegation.summaryReport?.keyPoints ?? [],
                changes: finishedDelegation.summaryReport?.changes ?? [],
                timeTakenMinutes: finishedDelegation.summaryReport?.timeTakenMinutes ?? 0,
                ...finishedDelegation.summaryReport,
                prUrl: result.prUrl,
                prState: 'open' as const,
              },
            })
            if (updated) {
              recordRuntimeExecuteLoopEvidence(updated, {
                pr: true,
                notes: 'PR evidence recorded after automatic PR creation.',
              })
              // Auto-review: assess DoD satisfaction against the git diff
              const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
              fetch(`${baseUrl}/api/delegations/${finishedDelegation.id}/quality-check`, {
                method: 'POST',
              }).catch(() => {})
              void autoMergePRIfEligible(result.prUrl, updated)
            }
          }
        })
      }

      // M116: Auto-Knowledge Extraction — fire-and-forget
      if (success) {
        extractKnowledge(finishedDelegation).catch(() => {
          // Non-critical — never block execution
        })
      }

      // M220: Knowledge Writeback — fire-and-forget
      if (success) {
        void writebackDelegationKnowledge(finishedDelegation, fullOutput)
          .then(result => {
            if (result.written) {
              recordRuntimeExecuteLoopEvidence(finishedDelegation, {
                writeback: true,
                notes: 'Knowledge writeback evidence recorded after delegation writeback completed.',
              })
            }
          })
          .catch(() => {})
      }

      // M108b: Failure Lesson Writeback — closes the intelligence loop for failed runs
      if (!success) {
        void writeFailureLessonCard(finishedDelegation).catch(() => {})
      }

      if (success && report) {
        persistGrokCriticForDelegation(finishedDelegation, report)
          .then(async criticScore => {
            if (criticScore) {
              const delegationWithCritic = { ...finishedDelegation, criticScore }
              recordRuntimeExecuteLoopEvidence(delegationWithCritic, {
                critic: true,
                notes: 'Critic evidence recorded after automatic critic persistence.',
              })
              void writebackExecutionInsights(delegationWithCritic)
              // G2: Critic Auto-Retry — queue retry if score below threshold
              const retryId = await triggerCriticRetry(finishedDelegation, criticScore).catch(() => null)
              if (retryId) {
                void appendLogs(id, [{
                  timestamp: new Date().toISOString(),
                  type: 'info',
                  message: `🔄 Critic-Auto-Retry gestartet → Delegation ${retryId}`,
                }])
              }
            }
          })
          .catch(() => {})
      }

      // Completion attention item
      const label = finishedDelegation.title || finishedDelegation.contract.goal.slice(0, 60)
      upsertAttentionItem({
        id: `completion:${id}`,
        type: success ? 'delegation_completed' : 'delegation_failed',
        severity: success ? 'info' : 'critical',
        title: success ? `✅ Abgeschlossen: ${label}` : `❌ Fehlgeschlagen: ${label}`,
        body: success
          ? `Agent-Lauf abgeschlossen${report?.prUrl ? ` · PR: ${report.prUrl}` : ''}${actualCost ? ` · $${actualCost.toFixed(4)}` : ''}`
          : knownError ?? `Exit-Code: ${code}`,
        delegationId: id,
        actionUrl: `/delegations/${id}`,
        createdAt: new Date().toISOString(),
      })

      // M204: fire-and-forget execution notification
      void notifyExecutionResult({ delegation: finishedDelegation, event: finalStatus })

      // M255: budget warning when actual cost ≥ 80% of limit
      if (success && actualCost) {
        const maxBudget = finishedDelegation.contract.maxBudgetUsd
        if (maxBudget && maxBudget > 0) {
          void notifyBudgetWarning({
            delegation: finishedDelegation,
            actualCostUsd: actualCost,
            maxBudgetUsd: maxBudget,
            usagePct: actualCost / maxBudget,
          })
        }
      }
      }
      } finally {
        await cleanupRunnerWorkspace()
      }
    })()
  })
}

async function runWithOllamaAgent(
  id: string,
  prompt: string,
  startTime: Date,
  budgetUsd: number,
  model: string,
) {
  const maxTurns = budgetToMaxTurns(budgetUsd)
  const reachable = await isOllamaReachable()
  if (!reachable) {
    const errLog: AgentLog = {
      timestamp: new Date().toISOString(),
      type: 'error',
      message: '❌ Ollama nicht erreichbar (http://localhost:11434). Bitte `ollama serve` starten.',
    }
    await appendLogs(id, [errLog], 'failed')
    upsertAttentionItem({
      id: `completion:${id}`,
      type: 'delegation_failed',
      severity: 'critical',
      title: `❌ Ollama nicht erreichbar`,
      body: 'Bitte Ollama starten (ollama serve) und erneut versuchen.',
      delegationId: id,
      actionUrl: `/delegations/${id}`,
      createdAt: new Date().toISOString(),
    })
    return
  }

  const runner = new OllamaAgentRunner(id, model, process.cwd(), {
    onLog: logs => void appendLogs(id, logs),
  })

  try {
    const result = await runner.run(prompt, maxTurns)
    const elapsed = Math.round((Date.now() - startTime.getTime()) / 60000)
    const finalLog: AgentLog = {
      timestamp: new Date().toISOString(),
      type: result.success ? 'success' : 'error',
      message: result.success
        ? `✅ Ollama-Run abgeschlossen (${result.turns} Turns)`
        : `❌ Ollama-Run fehlgeschlagen nach ${result.turns} Turns`,
    }
    const report: DelegationReport | undefined = result.success
      ? {
          keyPoints: [`Ollama-Run abgeschlossen mit ${model}`, result.summary.slice(0, 200)],
          changes: [],
          timeTakenMinutes: elapsed,
          costSavings: result.costSavings,
        }
      : undefined

    await appendLogs(id, [finalLog], result.success ? 'completed' : 'failed', report)

    const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
    const finished = await repo.findById(id)
    if (finished) {
      recordRuntimeExecuteLoopEvidence(finished, {
        blocker: result.success ? undefined : `Ollama run failed after ${result.turns} turns`,
        notes: result.success
          ? 'Ollama execution evidence recorded after runner completed.'
          : 'Ollama execution evidence recorded after runner failed.',
      })

      // M207: Fan-in — notify parent if this is a parallel sub-delegation
      void checkParallelCompletion(finished)

      // M230: Delegation chaining — fire-and-forget
      if (result.success) {
        void triggerChain(finished, result.summary).catch(() => {})
      }

      // Auto-PR: if Ollama run succeeded and git changes exist, open a PR
      if (result.success) {
        const prUrl = tryCreatePrFromGitChanges({
          workdir: process.cwd(),
          branchName: `ollama/${id.slice(0, 8)}-${Date.now()}`,
          commitMessage: `feat: ${(finished.title || finished.contract.goal).slice(0, 72)}\n\nDelegation: ${id}`,
          prTitle: finished.title || finished.contract.goal.slice(0, 72),
          prBody: `**Delegation:** ${id}\n**Model:** ${model}\n**Turns:** ${result.turns}\n\n${result.summary.slice(0, 500)}`,
          delegationId: id,
        })
        if (prUrl) {
          await appendLogs(id, [{
            timestamp: new Date().toISOString(),
            type: 'success',
            message: `🔗 Auto-PR erstellt: ${prUrl}`,
          }])
        }
      }

      const label = finished.title || finished.contract.goal.slice(0, 60)
      const savedStr = result.costSavings.savedUsd > 0
        ? ` · 💰 $${result.costSavings.savedUsd.toFixed(4)} gespart`
        : ''
      const tokensStr = result.tokenUsage.totalTokens > 0
        ? ` · ${result.tokenUsage.totalTokens.toLocaleString()} Tokens`
        : ''
      upsertAttentionItem({
        id: `completion:${id}`,
        type: result.success ? 'delegation_completed' : 'delegation_failed',
        severity: result.success ? 'info' : 'critical',
        title: result.success ? `✅ Abgeschlossen: ${label}` : `❌ Fehlgeschlagen: ${label}`,
        body: result.success
          ? `Ollama-Run abgeschlossen · ${result.turns} Turns · ${model}${tokensStr}${savedStr}`
          : `Run nach ${result.turns} Turns abgebrochen`,
        delegationId: id,
        actionUrl: `/delegations/${id}`,
        createdAt: new Date().toISOString(),
      })

      // M204: fire-and-forget execution notification
      void notifyExecutionResult({ delegation: finished, event: result.success ? 'completed' : 'failed' })
    }
  } catch (err) {
    const msg = (err as Error).message
    const errLog: AgentLog = {
      timestamp: new Date().toISOString(),
      type: 'error',
      message: `❌ Ollama-Runner-Fehler: ${msg}`,
    }
    await appendLogs(id, [errLog], 'failed')
  }
}

/**
 * Autonomous tool-use agent via Claude API.
 * Reads/writes files, runs safe commands, and commits code — no claude CLI required.
 * Uses the same buildPrompt() as the CLI mode so context cards are included.
 */
async function runWithClaudeAPI(id: string, delegation: Delegation, startTime: Date, contextCards: MemoryCard[]) {
  const storedKeys = readStoredApiKeys()
  const apiKey = storedKeys.ANTHROPIC_API_KEY?.trim() || ''

  const startLog: AgentLog = {
    timestamp: new Date().toISOString(),
    type: 'info',
    message: `🤖 Autonomer Tool-Use-Agent gestartet (Claude API, ${contextCards.length} Kontext-Karten)`,
  }
  await appendLogs(id, [startLog])

  const retryContext = buildRetryContext(delegation)
  const prompt = delegation.contract.orchestratedRunId
    ? buildSubTaskPrompt(delegation)
    : buildPrompt(delegation, contextCards, retryContext || undefined, delegation.targetRepo)

  try {
    const result = await runWithToolUse(prompt, {
      apiKey,
      model: delegation.contract.llmModel?.trim() || 'claude-sonnet-4-6',
      projectRoot: process.cwd(),
      maxTurns: budgetToMaxTurns(delegation.contract.maxBudgetUsd),
      budgetUsd: delegation.contract.maxBudgetUsd,
      onLog: (type, message) => {
        const logEntry: AgentLog = {
          timestamp: new Date().toISOString(),
          type: type as AgentLog['type'],
          message: message.slice(0, 1000),
        }
        appendLogs(id, [logEntry]).catch(() => undefined)
      },
    })

    const elapsed = Math.round((Date.now() - startTime.getTime()) / 60000)

    const finalLog: AgentLog = {
      timestamp: new Date().toISOString(),
      type: result.success ? 'success' : 'error',
      message: result.success
        ? `✅ Tool-Use-Agent abgeschlossen — ${result.turnsUsed} Turns, ~$${result.estimatedCostUsd.toFixed(4)}`
        : `⚠️ Agent beendet nach ${result.turnsUsed} Turns ohne task_complete`,
    }

    const report: DelegationReport = {
      keyPoints: [result.summary],
      changes: result.filesChanged,
      timeTakenMinutes: elapsed,
      filesModified: result.filesChanged,
      branchName: result.branchName,
      prUrl: result.prUrl,
      costSavings: {
        tokensUsed: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        claudeEquivalentUsd: result.estimatedCostUsd,
        actualCostUsd: result.estimatedCostUsd,
        savedUsd: 0,
        localModel: delegation.contract.llmModel || 'claude-sonnet-4-6',
      },
    }

    await appendLogs(id, [finalLog], result.success ? 'completed' : 'failed', report)

    const repoForLabel = createDelegationRepository(SINGLE_TENANT_USER_ID)
    const finished = await repoForLabel.findById(id)
    if (finished) {
      recordRuntimeExecuteLoopEvidence(finished, { notes: result.summary })
    }
    const label = finished?.title || delegation.contract.goal.slice(0, 60)
    upsertAttentionItem({
      id: `completion:${id}`,
      type: result.success ? 'delegation_completed' : 'delegation_failed',
      severity: result.success ? 'info' : 'warning',
      title: result.success ? `✅ Fertig: ${label}` : `⚠️ Unvollständig: ${label}`,
      body: result.summary.slice(0, 200),
      delegationId: id,
      actionUrl: `/delegations/${id}`,
      createdAt: new Date().toISOString(),
    })

    if (result.success && finished) {
      const skillCategory = finished.contract.skillCategory ?? 'full-stack'

      // Work quality scoring
      try {
        const filesChanged = result.filesChanged.length
        const durationMinutes = Math.round((Date.now() - startTime.getTime()) / 60000)
        const safeSkillCategory = (skillCategory as string) in {
          'api-route': 1, 'ui-component': 1, 'data-model': 1,
          'test': 1, 'refactor': 1, 'infrastructure': 1, 'documentation': 1,
        } ? skillCategory as import('@/lib/agents/agent-skills').SkillCategory : 'refactor' as const
        const workScore = scoreWork({
          task: {
            id: finished.id,
            title: finished.title ?? finished.contract.goal.slice(0, 60),
            description: finished.contract.goal,
            acceptanceCriteria: finished.contract.definitionOfDone ?? [],
            skillCategory: safeSkillCategory,
            assignedAgentType: 'general',
            filePatterns: finished.contract.allowedFilePatterns ?? [],
            effort: 'M',
            dependsOn: [],
            order: 0,
          },
          testsPassed: true,
          typeErrorCount: 0,
          lintErrorCount: 0,
          filesChanged,
          retryCount: 0,
          durationMinutes,
        })
        recordOutcome('general', safeSkillCategory, workScore)
      } catch {
        // Non-critical
      }

      // Linear writeback — fire-and-forget
      postLinearCompletionComment(finished).catch(() => {})

      // Knowledge extraction + writeback — fire-and-forget
      extractKnowledge(finished).catch(() => {})
      void writebackDelegationKnowledge(finished, result.summary)
        .then(wb => {
          if (wb.written) {
            recordRuntimeExecuteLoopEvidence(finished, {
              writeback: true,
              notes: 'Knowledge writeback after tool-use agent completed.',
            })
          }
        })
        .catch(() => {})

      // Grok critic + execution insights — fire-and-forget
      persistGrokCriticForDelegation(finished, report)
        .then(async criticScore => {
          if (criticScore) {
            const delegationWithCritic = { ...finished, criticScore }
            recordRuntimeExecuteLoopEvidence(delegationWithCritic, {
              critic: true,
              notes: 'Critic evidence after tool-use agent completion.',
            })
            void writebackExecutionInsights(delegationWithCritic)
          }
        })
        .catch(() => {})
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const errLog: AgentLog = {
      timestamp: new Date().toISOString(),
      type: 'error',
      message: `❌ Tool-Use-Runner-Fehler: ${msg}`,
    }
    await appendLogs(id, [errLog], 'failed')
    upsertAttentionItem({
      id: `completion:${id}`,
      type: 'delegation_failed',
      severity: 'critical',
      title: `❌ Tool-Use-Agent fehlgeschlagen`,
      body: msg.slice(0, 200),
      delegationId: id,
      actionUrl: `/delegations/${id}`,
      createdAt: new Date().toISOString(),
    })
  }
}

function runWithCodexCLI(id: string, prompt: string, startTime: Date, budgetUsd: number, riskClass: string, targetRepo?: string) {
  const storedKeys = readStoredApiKeys()
  const ghToken = storedKeys.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim()
  const maxTurns = budgetToClaudeCliMaxTurns(budgetUsd)
  const { OPENAI_API_KEY: _strippedOpenAI, ...baseEnv } = process.env
  const childEnv = {
    ...baseEnv,
    ...(ghToken ? { GH_TOKEN: ghToken, GITHUB_TOKEN: ghToken } : {}),
  }

  let runnerWorkspace: RunnerWorkspace
  try {
    runnerWorkspace = prepareRunnerWorkspace({ delegationId: id, targetRepo })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    void appendLogs(id, [{
      timestamp: new Date().toISOString(),
      type: 'error',
      message: `❌ Codex Runner-Workspace konnte nicht vorbereitet werden: ${msg}`,
    }], 'failed')
    upsertAttentionItem({
      id: `completion:${id}`,
      type: 'delegation_failed',
      severity: 'critical',
      title: '❌ Codex Runner-Workspace fehlgeschlagen',
      body: msg.slice(0, 200),
      delegationId: id,
      actionUrl: `/delegations/${id}`,
      createdAt: new Date().toISOString(),
    })
    return
  }

  void appendLogs(id, [{
    timestamp: new Date().toISOString(),
    type: 'info',
    message: `Codex Runner-Workspace vorbereitet: ${runnerWorkspace.path}`,
  }, {
    timestamp: new Date().toISOString(),
    type: 'info',
    message: 'Codex CLI startet im Zero-Key-Modus ueber lokale Subscription/OAuth.',
  }])

  const codexPrompt = `${prompt}

## ForgePilot Codex Runner Contract
- Work non-interactively and keep changes inside this repository.
- Use a task branch that starts with "${riskClass === 'A' ? 'feature' : 'fix'}/".
- Run the smallest meaningful validation before finishing.
- End with a concise summary containing changed files, validation commands, and branch name.
- Stop after about ${maxTurns} focused reasoning turns; do not wait for user input.`

  const proc = spawn(
    'codex',
    [
      'exec',
      '-C',
      runnerWorkspace.path,
      '--sandbox',
      'danger-full-access',
      '--dangerously-bypass-approvals-and-sandbox',
      '--json',
      codexPrompt,
    ],
    {
      cwd: runnerWorkspace.path,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...childEnv,
        FORGEPILOT_RUNNER_WORKTREE: runnerWorkspace.path,
      },
    },
  )
  proc.unref()

  if (proc.pid) {
    registerProcess(id, proc.pid)
  }

  const logBuffer: AgentLog[] = []
  let fullOutput = ''
  let flushTimer: ReturnType<typeof setTimeout> | null = null
  let startupTimer: ReturnType<typeof setTimeout> | null = null
  let sawOutput = false

  const startupTimeoutMs = Math.max(
    30_000,
    Number(process.env.FORGEPILOT_CLI_STARTUP_TIMEOUT_MS ?? 180_000),
  )

  const flush = () => {
    if (flushTimer) clearTimeout(flushTimer)
    flushTimer = setTimeout(() => {
      if (logBuffer.length > 0) {
        appendLogs(id, [...logBuffer]).catch(() => undefined)
        logBuffer.length = 0
      }
    }, 2000)
  }

  const clearStartupTimer = () => {
    if (startupTimer) {
      clearTimeout(startupTimer)
      startupTimer = null
    }
  }

  startupTimer = setTimeout(() => {
    if (sawOutput) return
    const timeoutSeconds = Math.round(startupTimeoutMs / 1000)
    const codexStallMessage = `Codex CLI hat nach ${timeoutSeconds}s keine Ausgabe geliefert. Bitte Codex CLI lokal mit \`codex exec "ping"\` testen und erneut starten.`
    void appendLogs(id, [{
      timestamp: new Date().toISOString(),
      type: 'error',
      message: codexStallMessage,
    }], 'failed')
    createDelegationRepository(SINGLE_TENANT_USER_ID)
      .update(id, { errorMessage: codexStallMessage, completedAt: new Date().toISOString() })
      .catch(() => {})
    try {
      if (proc.pid) process.kill(-proc.pid, 'SIGTERM')
    } catch {
      proc.kill('SIGTERM')
    }
  }, startupTimeoutMs)

  const addOutputLog = (type: AgentLog['type'], message: string) => {
    const cleaned = message.replace(/\s+/g, ' ').trim()
    if (!cleaned) return
    logBuffer.push({
      timestamp: new Date().toISOString(),
      type,
      message: cleaned.slice(0, 1000),
    })
    flush()
  }

  proc.stdout?.on('data', (chunk: Buffer) => {
    sawOutput = true
    clearStartupTimer()
    const text = chunk.toString()
    fullOutput += text
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const event = JSON.parse(trimmed) as Record<string, unknown>
        const eventType = String(event.type ?? event.msg ?? 'codex')
        const message = String(event.message ?? event.text ?? event.delta ?? event.event_msg ?? '')
        addOutputLog(eventType.toLowerCase().includes('error') ? 'error' : 'thought', message || eventType)
      } catch {
        addOutputLog('thought', trimmed)
      }
    }
  })

  proc.stderr?.on('data', (chunk: Buffer) => {
    sawOutput = true
    clearStartupTimer()
    const text = chunk.toString()
    fullOutput += text
    for (const line of text.split('\n').filter(l => l.trim())) {
      addOutputLog('error', line)
    }
  })

  proc.on('close', (code: number | null) => {
    if (flushTimer) clearTimeout(flushTimer)
    clearStartupTimer()
    unregisterProcess(id)

    const success = code === 0
    const elapsed = Math.round((Date.now() - startTime.getTime()) / 60000)
    const prUrl = parsePrUrlFromOutput(fullOutput)
    const knownError = !success ? detectKnownError(fullOutput) : undefined
    const finalLog: AgentLog = {
      timestamp: new Date().toISOString(),
      type: success ? 'success' : 'error',
      message: success
        ? `✅ Codex CLI-Ausführung abgeschlossen (Exit-Code: ${code}${prUrl ? `, PR: ${prUrl}` : ''})`
        : knownError
          ? `❌ ${knownError}`
          : `❌ Codex CLI-Ausführung fehlgeschlagen (Exit-Code: ${code ?? 'unknown'})`,
    }

    const report: DelegationReport | undefined = success
      ? {
          keyPoints: ['Ausführung via Codex CLI abgeschlossen'],
          changes: [],
          timeTakenMinutes: elapsed,
          ...(prUrl ? { prUrl, prState: 'open' as const } : {}),
        }
      : undefined

    void (async () => {
      try {
        const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
        const current = await repo.findById(id)
        if (!current || current.status !== 'running') return

        const finalStatus = success ? 'completed' : 'failed'
        const finishedDelegation = await repo.update(id, {
          status: finalStatus,
          completedAt: new Date().toISOString(),
          ...(!success ? { errorMessage: knownError ?? `Codex CLI failed with exit code ${code ?? 'unknown'}` } : {}),
          ...(report ? { summaryReport: report } : {}),
          logs: [...(current.logs ?? []), ...logBuffer, finalLog],
        })
        if (!finishedDelegation) return

        recordRuntimeExecuteLoopEvidence(finishedDelegation, {
          blocker: success ? undefined : knownError ?? `Exit-Code: ${code}`,
          notes: success
            ? 'Execution evidence recorded after Codex CLI reached completed state.'
            : 'Execution evidence recorded after Codex CLI failed.',
        })

        upsertAttentionItem({
          id: `completion:${id}`,
          type: success ? 'delegation_completed' : 'delegation_failed',
          severity: success ? 'info' : 'critical',
          title: success ? `✅ Codex fertig: ${finishedDelegation.title ?? finishedDelegation.contract.goal.slice(0, 60)}` : '❌ Codex Runner fehlgeschlagen',
          body: success ? 'Codex CLI hat die Delegation beendet.' : (knownError ?? 'Codex CLI-Ausfuehrung fehlgeschlagen.').slice(0, 200),
          delegationId: id,
          actionUrl: `/delegations/${id}`,
          createdAt: new Date().toISOString(),
        })

        if (success) {
          void createGitHubPRIfNeeded(finishedDelegation, fullOutput).then(async (result) => {
            if (!result.prUrl) return
            const prLog: AgentLog = {
              timestamp: new Date().toISOString(),
              type: 'success',
              message: `GitHub PR bereit: ${result.prUrl}`,
            }
            const latest = await repo.findById(id)
            if (!latest) return
            await repo.update(id, {
              summaryReport: {
                ...(latest.summaryReport ?? { keyPoints: [], changes: [], timeTakenMinutes: elapsed }),
                prUrl: result.prUrl,
                prState: 'open',
              },
              logs: [...(latest.logs ?? []), prLog],
            }).then(updated => {
              if (updated) void autoMergePRIfEligible(result.prUrl!, updated)
            })
          }).catch(() => {})
        }
      } finally {
        if (!shouldKeepRunnerWorktree({ success, env: process.env })) {
          try {
            runnerWorkspace.cleanup()
          } catch {
            // Best-effort cleanup only.
          }
        }
      }
    })()
  })
}

function runSimulation(id: string, delegation: Delegation) {
  const goal = delegation.contract.goal
  const budgetLog = buildSimulationBudgetLog(delegation)

  const steps: Array<{ delay: number; type: AgentLog['type']; message: string }> = [
    { delay: 800,  type: 'info',    message: `📋 Task geladen: ${goal.substring(0, 80)}` },
    { delay: 1200, type: budgetLog.type, message: budgetLog.message },
    { delay: 1800, type: 'info',    message: '🔍 Analysiere Projektstruktur...' },
    { delay: 3000, type: 'command', message: `$ git checkout -b ${delegation.contract.branchStrategy ?? 'feature'}/${(delegation.contract.workItemId ?? delegation.id).replace(/[^a-z0-9-]/gi, '-').toLowerCase()}-task` },
    { delay: 4500, type: 'thought', message: '💭 Verstehe Anforderungen aus Definition of Done...' },
    { delay: 6000, type: 'info',    message: '📝 Implementierung läuft...' },
    { delay: 9000, type: 'command', message: '$ npm test -- --run' },
    { delay: 11000,type: 'success', message: '✓ Tests grün' },
    { delay: 12500,type: 'command', message: `$ git commit -m "${delegation.contract.taskType || 'feat'}: ${goal.substring(0, 50).replace(/"/g, "'")}"` },
    { delay: 13500,type: 'command', message: '$ gh pr create --title "..." --body "..."' },
    { delay: 14500,type: 'success', message: '✅ Simulation abgeschlossen — echte Ausführung startet sobald Anthropic-Guthaben verfügbar ist' },
  ]

  let totalDelay = 0
  for (const step of steps) {
    totalDelay += step.delay
    const isLast = step === steps[steps.length - 1]
    const capturedDelay = totalDelay
    const capturedStep = step

    setTimeout(() => {
      const log: AgentLog = {
        timestamp: new Date().toISOString(),
        type: capturedStep.type,
        message: capturedStep.message,
      }
      const report: DelegationReport | undefined = isLast
        ? {
            keyPoints: [goal, 'Simulations-Lauf abgeschlossen'],
            changes: delegation.contract.definitionOfDone ?? [],
            timeTakenMinutes: Math.round(capturedDelay / 60000),
          }
        : undefined
      void appendLogs(id, [log], isLast ? 'completed' : undefined, report)
    }, capturedDelay)
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = await requireAuth()
  if (authError) return authError

  // Rate limit: 10 executions per minute per IP (AI calls are expensive)
  const rateCheck = checkRateLimit(_req, { limit: 10, windowSec: 60, keyPrefix: 'execute' })
  if (!rateCheck.allowed) {
    delegationLogger.warn({ event: 'delegation.execute.rate_limited', retryAfter: rateCheck.retryAfter })
    return NextResponse.json(
      { error: 'Too many requests. Please wait before executing another delegation.' },
      { status: 429, headers: buildRateLimitHeaders(rateCheck) },
    )
  }

  const { id } = await params

  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const delegation = await repo.findById(id)

  if (!delegation) {
    return NextResponse.json({ error: 'Delegation nicht gefunden' }, { status: 404 })
  }

  const blocker = getExecutionStartBlocker(delegation)
  if (blocker) {
    return NextResponse.json({ error: blocker.error }, { status: blocker.status })
  }

  // M4: Quick pre-flight — verify critical tools available before starting
  if (delegation.executionRoute === 'local-agent') {
    const preflightError = quickPreflightCheck()
    if (preflightError) {
      await appendLogs(id, [{
        timestamp: new Date().toISOString(),
        type: 'error',
        message: `⛔ Pre-Flight-Check fehlgeschlagen: ${preflightError}`,
      }], 'failed')
      return NextResponse.json({ error: preflightError, category: 'tool_missing' }, { status: 424 })
    }
  }

  // M209: Pre-execution budget guard — reject before starting if estimate exceeds limit
  if (wouldExceedBudget(delegation, delegation.costEstimateUsd)) {
    const limit = getBudgetLimit(delegation)
    return NextResponse.json(
      { error: `Estimated cost $${delegation.costEstimateUsd} exceeds budget limit $${limit}` },
      { status: 422 },
    )
  }

  // Auto-orchestrate: decompose into sub-tasks and run each sequentially
  if (delegation.autoOrchestrate) {
    const startLog = buildExecutionStartLog(delegation)
    await appendLogs(id, [startLog], 'running')

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

    // Create orchestrated run
    const orchRes = await fetch(`${baseUrl}/api/agents/orchestrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        delegationId: id,
        delegationTitle: delegation.title || delegation.contract.goal,
        goal: delegation.contract.goal,
        context: delegation.contract.context,
      }),
    })
    const { run } = await orchRes.json() as { run: { id: string } }

    // Fire-and-forget execution
    fetch(`${baseUrl}/api/agents/orchestrate/${run.id}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).catch((err: unknown) => {
      delegationLogger.error({ event: 'delegation.orchestrate_error', delegationId: id, error: String(err) }, 'Orchestration trigger failed')
    })

    return NextResponse.json({ started: true, mode: 'orchestrated', delegationId: id, runId: run.id })
  }

  // Immediately mark as running + record start time
  const startLog = buildExecutionStartLog(delegation)
  await appendLogs(id, [startLog], 'running')
  {
    const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
    await repo.update(id, { startedAt: new Date().toISOString() })
  }

  const startTime = new Date()

  // Build context package from knowledge cards — non-critical, never blocks execution
  let contextCards: MemoryCard[] | undefined
  try {
    const pkg = await buildContextPackage(delegation.contract.goal, {
      workItemId: delegation.contract.workItemId,
      delegationId: delegation.id,
      maxCards: 4,
    })
    if (pkg.cards.length > 0) {
      contextCards = pkg.cards
      delegationLogger.info({ event: 'context.package', cardCount: pkg.cards.length, tokenEstimate: pkg.tokenEstimate })
      // M305: persist which cards influenced this execution
      const snapshotRepo = createDelegationRepository(SINGLE_TENANT_USER_ID)
      await snapshotRepo.update(id, {
        contextSnapshot: {
          cards: pkg.cards.map(c => ({ id: c.id, title: c.title, type: c.type, tags: c.tags })),
          tokenEstimate: pkg.tokenEstimate,
          builtAt: new Date().toISOString(),
        },
      })
    }
  } catch {
    // Non-critical — never block execution
  }

  // Use focused sub-task prompt when this is part of an orchestrated run
  const retryContext = buildRetryContext(delegation)
  const prompt = delegation.contract.orchestratedRunId
    ? buildSubTaskPrompt(delegation)
    : buildPrompt(delegation, contextCards, retryContext || undefined, delegation.targetRepo)

  // OTel: trace execution start + routing decision
  let runnerReadiness = getCachedOrShallowRunnerReadiness()
  if (
    delegation.executionRoute !== 'ollama-agent'
    && !runnerReadiness.zeroKeyReady
    && (runnerReadiness.claude.available || runnerReadiness.codex.available)
  ) {
    runnerReadiness = getRunnerReadiness({ deep: true })
    writeCachedRunnerReadiness(runnerReadiness)
  }

  const mode = selectDelegationExecutionMode({
    executionRoute: delegation.executionRoute,
    runnerReadiness,
    anthropicApiKeySet: Boolean(readStoredApiKeys().ANTHROPIC_API_KEY?.trim()),
  })

  // Safety: the claude-api and ollama-agent runners execute in ForgePilot's OWN
  // working directory and do NOT honor an external targetRepo yet — running them
  // against a different project would silently edit ForgePilot itself. Refuse
  // loudly instead (the Claude CLI runner handles external repos via a workspace).
  if ((mode === 'claude-api' || mode === 'ollama-agent') && delegation.targetRepo) {
    const home = process.env.HOME ?? ''
    const targetResolved = pathMod.resolve(delegation.targetRepo.replace(/^~(?=\/|$)/, home))
    if (targetResolved !== pathMod.resolve(process.cwd())) {
      await appendLogs(id, [{
        timestamp: new Date().toISOString(),
        type: 'error',
        message: `⛔ Runner '${mode}' kann (noch) nicht in ein externes Ziel-Repo schreiben — das würde ForgePilot selbst ändern. Ziel: ${delegation.targetRepo}. Für externe Repos den Claude-CLI-Runner nutzen (ggf. \`claude login\`).`,
      }], 'failed')
      return NextResponse.json({ started: false, mode, error: 'external-target-not-supported-by-runner', delegationId: id }, { status: 409 })
    }
  }

  void withSpan('delegation.execute', {
    'delegation.id':          id,
    'delegation.mode':        mode,
    'delegation.riskClass':   delegation.contract.riskClass,
    'delegation.privacyMode': delegation.contract.privacyMode,
    'delegation.budget':      delegation.contract.maxBudgetUsd ?? 0,
  }, async () => Promise.resolve())

  if (mode === 'ollama-agent') {
    const model = delegation.contract.llmModel?.trim() || 'qwen2.5-coder:14b'
    void runWithOllamaAgent(id, prompt, startTime, delegation.contract.maxBudgetUsd, model)
    return NextResponse.json({ started: true, mode: 'ollama-agent', delegationId: id, model })
  }

  if (mode === 'claude-cli') {
    // Workspace reuse — two cases that both let the agent build on existing work
    // instead of starting from a fresh clone:
    //   (a) Resume: this delegation already has its own worktree (e.g. budget-paused
    //       and resumed with more budget) — continue right where it left off.
    //   (b) Chain: build on top of the previous chain phase's workspace.
    let chainWorkspace: RunnerWorkspace | undefined
    if (delegation.worktreePath) {
      const own = reuseExistingWorkspace(delegation.worktreePath)
      if (own) {
        chainWorkspace = own
        await appendLogs(id, [{
          timestamp: new Date().toISOString(),
          type: 'info',
          message: `↩️ Setze im eigenen Workspace fort: ${delegation.worktreePath}`,
        }])
      }
    }
    if (!chainWorkspace && delegation.chainedFromId) {
      const prev = await repo.findById(delegation.chainedFromId)
      if (prev?.worktreePath) {
        const reused = reuseExistingWorkspace(prev.worktreePath)
        if (reused) {
          chainWorkspace = reused
          await appendLogs(id, [{
            timestamp: new Date().toISOString(),
            type: 'info',
            message: `⛓️ Baue auf Workspace der vorherigen Phase auf: ${prev.worktreePath}`,
          }])
        }
      }
    }
    runWithClaudeCLI(id, prompt, startTime, delegation.contract.maxBudgetUsd, delegation.contract.riskClass, delegation.targetRepo, chainWorkspace, { goal: delegation.contract.goal, context: delegation.contract.context ?? '' })
    return NextResponse.json({ started: true, mode: 'claude-cli', delegationId: id })
  }

  if (mode === 'codex-cli') {
    runWithCodexCLI(id, prompt, startTime, delegation.contract.maxBudgetUsd, delegation.contract.riskClass, delegation.targetRepo)
    return NextResponse.json({ started: true, mode: 'codex-cli', delegationId: id })
  }

  // Fallback 1: Claude API tool-use loop — real code execution, no CLI required
  if (mode === 'claude-api') {
    void runWithClaudeAPI(id, delegation, startTime, contextCards ?? [])
    return NextResponse.json({ started: true, mode: 'claude-api', delegationId: id })
  }

  // Fallback 2: pure simulation (no API key, no CLI)
  runSimulation(id, delegation)
  return NextResponse.json({ started: true, mode: 'simulation', delegationId: id })
}
