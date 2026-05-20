/**
 * pr-status.ts — GitHub Pull Request CI status fetcher (M134)
 *
 * Fetches the combined commit status + check runs for a PR URL.
 * Uses the same GITHUB_TOKEN resolution as pr-creator.ts.
 * Never logs the token.
 */

import { readStoredApiKeys } from '@/lib/connectors/config'

export type CIState = 'pending' | 'success' | 'failure' | 'error' | 'unknown'

export interface PRStatusResult {
  prNumber: number
  owner: string
  repo: string
  title: string
  state: 'open' | 'closed' | 'merged'
  ciState: CIState
  ciChecks: Array<{
    name: string
    status: 'queued' | 'in_progress' | 'completed'
    conclusion: string | null
    url: string
  }>
  headSha: string
  updatedAt: string
  error?: string
}

/** Parse a GitHub PR URL into owner / repo / number. */
export function parsePrUrl(url: string): { owner: string; repo: string; prNumber: number } | null {
  const m = /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/.exec(url)
  if (!m) return null
  return { owner: m[1], repo: m[2], prNumber: parseInt(m[3], 10) }
}

/** Get the stored GitHub token — undefined when not configured. */
function getToken(): string | undefined {
  try {
    const keys = readStoredApiKeys()
    return keys.GITHUB_TOKEN?.trim() || undefined
  } catch {
    return process.env.GITHUB_TOKEN?.trim() || undefined
  }
}

interface GitHubPRData {
  number: number
  title: string
  state: string
  merged_at: string | null
  head: { sha: string }
  updated_at: string
}

interface GitHubCheckRun {
  name: string
  status: 'queued' | 'in_progress' | 'completed'
  conclusion: string | null
  html_url: string
}

interface GitHubCheckRunsResponse {
  check_runs: GitHubCheckRun[]
}

/**
 * Fetch PR metadata + CI status for a PR URL.
 * Returns a best-effort result even when CI data is unavailable.
 */
export async function fetchPRStatus(prUrl: string): Promise<PRStatusResult> {
  const parsed = parsePrUrl(prUrl)
  if (!parsed) {
    return {
      prNumber: 0, owner: '', repo: '',
      title: '', state: 'open', ciState: 'unknown',
      ciChecks: [], headSha: '', updatedAt: '',
      error: 'Invalid PR URL',
    }
  }
  const { owner, repo, prNumber } = parsed
  const token = getToken()
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const base = `https://api.github.com/repos/${owner}/${repo}`

  // ── fetch PR metadata ───────────────────────────────────────────────
  const prRes = await fetch(`${base}/pulls/${prNumber}`, { headers })
  if (!prRes.ok) {
    const msg = `GitHub API error: ${prRes.status}`
    return { prNumber, owner, repo, title: '', state: 'open', ciState: 'unknown', ciChecks: [], headSha: '', updatedAt: '', error: msg }
  }
  const pr = await prRes.json() as GitHubPRData
  const state: PRStatusResult['state'] = pr.merged_at ? 'merged' : (pr.state === 'closed' ? 'closed' : 'open')
  const headSha = pr.head.sha

  // ── fetch check runs for head commit ───────────────────────────────
  const checksRes = await fetch(`${base}/commits/${headSha}/check-runs?per_page=50`, { headers })
  let ciChecks: PRStatusResult['ciChecks'] = []
  let ciState: CIState = 'unknown'

  if (checksRes.ok) {
    const checksData = await checksRes.json() as GitHubCheckRunsResponse
    ciChecks = checksData.check_runs.map(cr => ({
      name: cr.name,
      status: cr.status,
      conclusion: cr.conclusion,
      url: cr.html_url,
    }))
    ciState = deriveCIState(ciChecks)
  }

  return {
    prNumber, owner, repo,
    title: pr.title,
    state,
    ciState,
    ciChecks,
    headSha,
    updatedAt: pr.updated_at,
  }
}

/** Derive a single CIState from check runs array. */
function deriveCIState(checks: PRStatusResult['ciChecks']): CIState {
  if (checks.length === 0) return 'unknown'
  const conclusions = checks.map(c => c.conclusion)
  if (conclusions.some(c => c === 'failure' || c === 'timed_out' || c === 'cancelled')) return 'failure'
  if (checks.some(c => c.status !== 'completed')) return 'pending'
  if (conclusions.every(c => c === 'success' || c === 'skipped' || c === 'neutral')) return 'success'
  return 'unknown'
}
