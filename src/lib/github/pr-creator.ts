/**
 * pr-creator.ts — GitHub Pull Request creation via REST API.
 *
 * Uses GITHUB_TOKEN from config/api-keys.json (set via Settings UI).
 * Resolves owner/repo from GITHUB_REPOSITORY env var, git remote, or package.json.
 * Never logs or returns the token value.
 */

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { readStoredApiKeys } from '@/lib/connectors/config'
import { apiLogger } from '@/lib/logger'
import type { Delegation } from '@/lib/models/delegation'

export interface PRCreationOptions {
  title: string
  body: string
  branch: string
  baseBranch?: string
  labels?: string[]
}

export interface PRResult {
  url: string
  number: number
  status: 'created' | 'already_exists' | 'error'
  error?: string
}

interface GitHubPRResponse {
  html_url: string
  number: number
}

interface GitHubErrorResponse {
  message?: string
  errors?: Array<{ message?: string }>
}

function splitOwnerRepo(value: string | undefined): { owner: string; repo: string } | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const parts = trimmed.split('/').filter(Boolean)
  if (parts.length !== 2) return null
  return { owner: parts[0], repo: parts[1] }
}

/**
 * Resolve GitHub owner and repo name.
 * Priority:
 * 1. GITHUB_REPOSITORY or owner/repo-style GITHUB_REPO
 * 2. GITHUB_OWNER + GITHUB_REPO / GITHUB_REPOSITORY_OWNER + GITHUB_REPOSITORIES
 * 3. git remote
 * 4. package.json repository field
 */
function resolveOwnerAndRepo(): { owner: string; repo: string } | null {
  const explicit = splitOwnerRepo(process.env.GITHUB_REPOSITORY) ?? splitOwnerRepo(process.env.GITHUB_REPO)
  if (explicit) return explicit

  const owner = process.env.GITHUB_OWNER?.trim() || process.env.GITHUB_REPOSITORY_OWNER?.trim()
  const repoList = process.env.GITHUB_REPOSITORIES?.trim() || process.env.GITHUB_REPO?.trim()
  const repo = repoList?.split(',').map(part => part.trim()).find(Boolean)
  if (owner && repo && !repo.includes('/')) {
    return { owner, repo }
  }

  try {
    const remoteUrl = execSync('git remote get-url origin', {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 3000,
    }).toString().trim()

    // SSH: git@github.com:owner/repo.git
    const sshMatch = /git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/.exec(remoteUrl)
    if (sshMatch) {
      return { owner: sshMatch[1], repo: sshMatch[2] }
    }

    // HTTPS: https://github.com/owner/repo.git
    const httpsMatch = /github\.com\/([^/]+)\/(.+?)(?:\.git)?$/.exec(remoteUrl)
    if (httpsMatch) {
      return { owner: httpsMatch[1], repo: httpsMatch[2] }
    }
  } catch {
    // git not available or no remote — continue to next fallback
  }

  // 3. package.json "repository" field
  try {
    const pkgPath = path.join(process.cwd(), 'package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as {
      repository?: string | { type?: string; url?: string }
    }
    const repoUrl = typeof pkg.repository === 'string'
      ? pkg.repository
      : pkg.repository?.url ?? ''

    const match = /github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/.exec(repoUrl)
    if (match) {
      return { owner: match[1], repo: match[2] }
    }
  } catch {
    // no package.json or not parseable
  }

  return null
}

/**
 * Create a GitHub Pull Request via the REST API.
 *
 * - Returns `status: 'error'` (instead of throwing) when no token is configured
 *   or when an unexpected error occurs.
 * - Returns `status: 'already_exists'` when a PR for the branch already exists (422).
 * - Returns `status: 'created'` on success.
 *
 * The GITHUB_TOKEN is never included in logs or in the returned object.
 */
export async function createGitHubPR(opts: PRCreationOptions): Promise<PRResult> {
  const stored = readStoredApiKeys()
  const token = stored.GITHUB_TOKEN?.trim()
    || process.env.GITHUB_TOKEN?.trim()
    || process.env.GH_TOKEN?.trim()

  if (!token) {
    return {
      url: '',
      number: 0,
      status: 'error',
      error: 'No GitHub token configured. Add GITHUB_TOKEN in Settings → API Keys.',
    }
  }

  const coords = resolveOwnerAndRepo()
  if (!coords) {
    return {
      url: '',
      number: 0,
      status: 'error',
      error: 'Could not resolve GitHub owner/repo. Set GITHUB_REPOSITORY env var (format: owner/repo).',
    }
  }

  const { owner, repo } = coords
  const base = opts.baseBranch ?? 'main'
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/pulls`

  const body: Record<string, unknown> = {
    title: opts.title,
    body: opts.body,
    head: opts.branch,
    base,
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify(body),
    })

    // PR created successfully
    if (response.status === 201) {
      const pr = (await response.json()) as GitHubPRResponse
      // Apply labels if requested (fire-and-forget, non-critical)
      if (opts.labels && opts.labels.length > 0) {
        void applyLabels(owner, repo, pr.number, opts.labels, token)
      }
      return { url: pr.html_url, number: pr.number, status: 'created' }
    }

    // 422 = Unprocessable — most likely "A pull request already exists for this branch"
    if (response.status === 422) {
      const err = (await response.json()) as GitHubErrorResponse
      const alreadyExists =
        err.errors?.some(e => e.message?.toLowerCase().includes('pull request already exists')) ||
        err.message?.toLowerCase().includes('pull request already exists')

      if (alreadyExists) {
        // Fetch the existing PR to return its URL and number
        const existing = await fetchExistingPR(owner, repo, opts.branch, base, token)
        if (existing) {
          return { url: existing.url, number: existing.number, status: 'already_exists' }
        }
        return {
          url: '',
          number: 0,
          status: 'already_exists',
          error: 'PR already exists but could not retrieve its URL.',
        }
      }

      const message = err.errors?.[0]?.message ?? err.message ?? 'Unprocessable Entity'
      return { url: '', number: 0, status: 'error', error: `GitHub API 422: ${message}` }
    }

    // Other HTTP errors
    let errorText = `GitHub API responded with HTTP ${response.status}`
    try {
      const errJson = (await response.json()) as GitHubErrorResponse
      if (errJson.message) errorText += `: ${errJson.message}`
    } catch {
      // ignore JSON parse failure
    }
    return { url: '', number: 0, status: 'error', error: errorText }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { url: '', number: 0, status: 'error', error: `Network error: ${message}` }
  }
}

/**
 * Fetch an existing PR for the given head branch.
 */
async function fetchExistingPR(
  owner: string,
  repo: string,
  head: string,
  base: string,
  token: string,
): Promise<{ url: string; number: number } | null> {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls?head=${owner}:${head}&base=${base}&state=open`
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
    if (!response.ok) return null
    const prs = (await response.json()) as GitHubPRResponse[]
    if (prs.length > 0) {
      return { url: prs[0].html_url, number: prs[0].number }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Apply labels to a PR. Requires "issues" write permission on the token.
 * Silently fails — label application is non-critical.
 */
async function applyLabels(
  owner: string,
  repo: string,
  prNumber: number,
  labels: string[],
  token: string,
): Promise<void> {
  try {
    await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/labels`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ labels }),
    })
  } catch {
    // Non-critical — ignore
  }
}

// ── Auto-PR creation after successful execution ──────────────────────────────

export interface GitHubPRResult {
  prUrl: string | null
  skipped: boolean
  reason?: string
}

/** True when targetRepo is a local filesystem path (not a github.com URL). */
function isLocalTargetRepo(targetRepo: string | undefined): boolean {
  return Boolean(targetRepo && /^[~./]/.test(targetRepo))
}

/**
 * Attempt to create a GitHub draft PR for a completed delegation.
 * Only fires when:
 * - GITHUB_TOKEN is set (env or stored API keys)
 * - GITHUB_REPO or GITHUB_REPOSITORY is set (format: "owner/repo")
 * - delegation.summaryReport.prUrl is not already set
 * - delegation.status is 'completed'
 * - the delegation does NOT target a local repo (a local path has no GitHub
 *   remote — committing locally is the deliverable; the writeback already
 *   merged the result, so attempting `gh pr create` only produces 422 noise)
 * - execution produced a branch name in agentOutput or contract fields
 * Never throws.
 */
export async function createGitHubPRIfNeeded(
  delegation: Delegation,
  agentOutput?: string,
): Promise<GitHubPRResult> {
  // Cheap early bailouts — no credentials needed
  if (delegation.summaryReport?.prUrl) {
    return { prUrl: delegation.summaryReport.prUrl, skipped: true, reason: 'prUrl already set' }
  }

  if (delegation.status !== 'completed') {
    return { prUrl: null, skipped: true, reason: 'delegation not completed' }
  }

  // Local target repos have no GitHub remote — skip the PR attempt entirely so
  // the caller can log a calm "local target" line instead of a 422 warning.
  if (isLocalTargetRepo(delegation.targetRepo)) {
    return { prUrl: null, skipped: true, reason: 'local_target' }
  }

  const stored = readStoredApiKeys()
  const token = stored.GITHUB_TOKEN?.trim()
    || process.env.GITHUB_TOKEN?.trim()
    || process.env.GH_TOKEN?.trim()

  if (!token) {
    return { prUrl: null, skipped: true, reason: 'GITHUB_TOKEN not configured' }
  }

  const coords = resolveOwnerAndRepo()
  if (!coords) {
    return {
      prUrl: null,
      skipped: true,
      reason: 'GitHub repository not configured. Set GITHUB_REPOSITORY=owner/repo or GITHUB_OWNER + GITHUB_REPO.',
    }
  }

  const branchName = extractBranchName(agentOutput, delegation)
  if (!branchName) {
    return { prUrl: null, skipped: true, reason: 'no branch name found in output' }
  }

  try {
    const title = delegation.title || delegation.contract.goal.slice(0, 60)
    const body = buildPRBody(delegation)
    const result = await createGitHubPR({
      title,
      body,
      branch: branchName,
      baseBranch: 'main',
      labels: ['delegation', delegation.contract.taskType ?? 'feature'].filter(Boolean),
    })

    if (result.status === 'error') {
      apiLogger.warn(
        { event: 'github.pr.failed', reason: result.error },
        'GitHub PR creation failed',
      )
      return { prUrl: null, skipped: true, reason: result.error ?? 'GitHub PR creation failed' }
    }

    apiLogger.info(
      { event: 'github.pr.created', delegationId: delegation.id, prUrl: result.url, status: result.status },
      result.status === 'already_exists' ? 'GitHub PR already exists' : 'GitHub PR created',
    )
    return { prUrl: result.url, skipped: result.status === 'already_exists', reason: result.status }
  } catch (error) {
    apiLogger.error(
      { event: 'github.pr.error', error: error instanceof Error ? error.message : String(error) },
      'GitHub PR creation threw',
    )
    return {
      prUrl: null,
      skipped: true,
      reason: error instanceof Error ? error.message : 'unknown error',
    }
  }
}

function extractBranchName(agentOutput: string | undefined, delegation: Delegation): string | null {
  if (agentOutput) {
    // Look for common branch patterns in agent output
    const branchMatch = /(?:branch[:\s]+|git checkout -b\s+)([a-zA-Z0-9][a-zA-Z0-9/_-]*)/i.exec(agentOutput)
    if (branchMatch?.[1]) return branchMatch[1]

    const prefixedBranchMatch = /\b((?:feature|fix|chore|docs|test|refactor|hotfix)\/[a-zA-Z0-9/_-]+)/i.exec(agentOutput)
    if (prefixedBranchMatch?.[1]) return prefixedBranchMatch[1]
  }
  // Fall back to agentRunId if it looks like a branch name
  if (delegation.agentRunId?.includes('/')) {
    return delegation.agentRunId
  }
  // Derive from contract fields (same logic as execute route)
  const slug = delegation.contract.workItemId.replace(/[^a-z0-9-]/gi, '-').toLowerCase()
  const derived = `${delegation.contract.branchStrategy}/${slug}-task`
  return derived || null
}

function buildPRBody(delegation: Delegation): string {
  const score = delegation.criticScore
  const scoreSection = score
    ? `## Critic Score\n- Correctness: ${score.correctness}/100\n- Efficiency: ${score.efficiency}/100\n- Drift: ${score.drift}/100\n- Verdict: ${score.verdict}\n\n> ${score.summary}`
    : ''

  return `## Delegation: ${delegation.title || delegation.contract.goal.slice(0, 60)}

Auto-created by ForgePilot after successful execution.

${scoreSection}

---
*Delegation ID: \`${delegation.id}\` | Route: ${delegation.executionRoute ?? 'unknown'}*`
}
