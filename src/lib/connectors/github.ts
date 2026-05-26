import type { WorkItem, WorkItemStatus, RiskClass } from '@/lib/models/work-item'
import type { ConnectorHealth, ConnectorManifest } from './types'
import {
  degradedHealth,
  errorHealth,
  type Fetcher,
  missingConfigHealth,
  okHealth,
  parseRateLimit,
} from './shared'

export interface GitHubConnectorConfig {
  token?: string
  owner?: string
  repositories?: string[]
  apiUrl?: string
}

interface GitHubUserItem {
  login?: string
}

interface GitHubPullRequestView {
  id: number
  number: number
  title: string
  html_url: string
  state: 'open' | 'closed'
  draft?: boolean
  merged_at?: string | null
  body?: string | null
  head?: { ref?: string; sha?: string; repo?: { full_name?: string } | null }
  base?: { ref?: string }
  mergeable?: boolean | null
  mergeable_state?: string
  additions?: number
  deletions?: number
  changed_files?: number
  commits?: number
  labels?: Array<{ name: string }>
  user?: GitHubUserItem | null
  updated_at: string
  created_at: string
}

interface GitHubPullRequestFileView {
  filename: string
  status: string
  additions: number
  deletions: number
  changes: number
  patch?: string
}

interface GitHubCommitView {
  sha: string
  html_url?: string
  commit?: { message?: string }
}

interface GitHubIssueView {
  id: number
  number: number
  title: string
  html_url: string
  state: 'open' | 'closed'
  labels?: Array<{ name: string }>
  user?: GitHubUserItem | null
  updated_at: string
  created_at: string
}

export const githubConnectorManifest: ConnectorManifest = {
  id: 'github',
  name: 'GitHub',
  category: 'code',
  authType: 'api-key',
  capabilities: ['read-items', 'read-prs', 'read-ci', 'write-items'],
  configSchema: {
    token: {
      type: 'secret',
      label: 'Personal Access Token',
      required: true,
      description: 'GitHub token with read access to selected repositories',
    },
    owner: {
      type: 'string',
      label: 'Repository Owner',
      required: true,
      placeholder: 'Jokerbitt',
    },
    repositories: {
      type: 'string-list',
      label: 'Repositories',
      required: true,
      description: 'Komma-separierte Repository-Namen die in ForgePilot synchronisiert werden',
      placeholder: 'forgepilot,daily-briefing',
    },
  },
  docsUrl: 'https://docs.github.com/en/rest',
}

export interface GitHubCreateIssueInput {
  owner: string
  repo: string
  title: string
  body?: string
  labels?: string[]
}

export interface GitHubCreatedIssue {
  id: number
  number: number
  html_url: string
  title: string
}

export interface GitHubPullRequestSummary {
  number: number
  title: string
  url: string
  state: 'open' | 'closed'
  draft: boolean
  author?: string
  headRef: string
  headSha: string
  baseRef: string
  updatedAt: string
  mergeable: boolean | null
  mergeableState?: string
  additions: number
  deletions: number
  changedFiles: number
  commits: number
  risk: 'low' | 'medium' | 'high'
}

export interface GitHubPullRequestPreview extends GitHubPullRequestSummary {
  body?: string
  files: Array<{
    filename: string
    status: string
    additions: number
    deletions: number
    changes: number
    patchPreview?: string
  }>
  commitMessages: Array<{ sha: string; message: string; url?: string }>
  checks: {
    state: 'success' | 'failure' | 'pending' | 'error' | 'unknown'
    items: Array<{ name: string; status: string; url?: string }>
  }
  mergeRecommendation: {
    status: 'ready' | 'review' | 'blocked'
    reasons: string[]
  }
}

export interface GitHubMergePullRequestInput {
  number: number
  sha?: string
  title?: string
  message?: string
}

export interface GitHubMergePullRequestResult {
  sha?: string
  merged: boolean
  message: string
}

function getDefaultRepo(config: GitHubConnectorConfig): { owner: string; repo: string; apiUrl: string; token: string } {
  const token = config.token?.trim()
  const owner = config.owner?.trim() || 'Jokerbitt'
  const repo = config.repositories?.[0]?.trim() || 'forgepilot'
  if (!token) throw new Error('GITHUB_TOKEN not configured')
  return { owner, repo, apiUrl: config.apiUrl ?? 'https://api.github.com', token }
}

function githubHeaders(token: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

async function githubJson<T>(url: string, token: string, fetcher: Fetcher, init?: RequestInit): Promise<T> {
  const response = await fetcher(url, {
    ...init,
    headers: {
      ...githubHeaders(token),
      ...(init?.headers ?? {}),
    },
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`GitHub API error: HTTP ${response.status}${text ? ` ${text.slice(0, 180)}` : ''}`)
  }
  return await response.json() as T
}

function toPullRequestSummary(pr: GitHubPullRequestView): GitHubPullRequestSummary {
  const changedFiles = pr.changed_files ?? 0
  const additions = pr.additions ?? 0
  const deletions = pr.deletions ?? 0
  return {
    number: pr.number,
    title: pr.title,
    url: pr.html_url,
    state: pr.state,
    draft: Boolean(pr.draft),
    author: pr.user?.login,
    headRef: pr.head?.ref ?? '',
    headSha: pr.head?.sha ?? '',
    baseRef: pr.base?.ref ?? 'main',
    updatedAt: pr.updated_at,
    mergeable: pr.mergeable ?? null,
    mergeableState: pr.mergeable_state,
    additions,
    deletions,
    changedFiles,
    commits: pr.commits ?? 0,
    risk: inferPullRequestReviewRisk(pr.title, changedFiles, additions + deletions, pr.draft),
  }
}

function inferPullRequestReviewRisk(
  title: string,
  changedFiles: number,
  lineChanges: number,
  draft?: boolean,
): 'low' | 'medium' | 'high' {
  const haystack = title.toLowerCase()
  if (draft || haystack.includes('security') || haystack.includes('auth') || haystack.includes('migration')) return 'high'
  if (changedFiles >= 8 || lineChanges >= 500 || haystack.includes('refactor')) return 'medium'
  return 'low'
}

function buildMergeRecommendation(
  pr: GitHubPullRequestSummary,
  checks: GitHubPullRequestPreview['checks'],
): GitHubPullRequestPreview['mergeRecommendation'] {
  const reasons: string[] = []
  if (pr.draft) reasons.push('Pull Request ist noch als Draft markiert.')
  if (pr.state !== 'open') reasons.push('Pull Request ist nicht offen.')
  if (pr.mergeable === false) reasons.push('GitHub meldet Merge-Konflikte.')
  if (checks.state === 'failure' || checks.state === 'error') reasons.push('Mindestens ein Check ist fehlgeschlagen.')
  if (checks.state === 'pending') reasons.push('Checks laufen noch.')
  if (pr.risk === 'high') reasons.push('Hohe Risiko-Einstufung: manuelles Review empfohlen.')

  if (reasons.some(reason => /Draft|nicht offen|Merge-Konflikte|fehlgeschlagen/i.test(reason))) {
    return { status: 'blocked', reasons }
  }
  if (reasons.length > 0 || pr.mergeable === null || checks.state === 'unknown') {
    return { status: 'review', reasons: reasons.length ? reasons : ['GitHub hat Mergebarkeit oder Checks noch nicht vollstaendig bewertet.'] }
  }
  return { status: 'ready', reasons: ['PR ist offen, mergebar und Checks sind gruen.'] }
}

async function getPullRequestChecks(
  config: { apiUrl: string; owner: string; repo: string; token: string },
  sha: string,
  fetcher: Fetcher,
): Promise<GitHubPullRequestPreview['checks']> {
  if (!sha) return { state: 'unknown', items: [] }
  try {
    const data = await githubJson<{
      check_runs?: Array<{ name?: string; conclusion?: string | null; status?: string; html_url?: string }>
    }>(
      `${config.apiUrl}/repos/${config.owner}/${config.repo}/commits/${sha}/check-runs`,
      config.token,
      fetcher,
    )
    const runs = data.check_runs ?? []
    const items = runs.map(run => ({
      name: run.name ?? 'GitHub Check',
      status: run.conclusion ?? run.status ?? 'unknown',
      url: run.html_url,
    }))
    if (items.length === 0) return { state: 'unknown', items }
    if (items.some(item => ['failure', 'timed_out', 'cancelled'].includes(item.status))) return { state: 'failure', items }
    if (items.some(item => ['action_required', 'startup_failure'].includes(item.status))) return { state: 'error', items }
    if (items.some(item => !['success', 'skipped', 'neutral'].includes(item.status))) return { state: 'pending', items }
    return { state: 'success', items }
  } catch {
    return { state: 'unknown', items: [] }
  }
}

export async function listGitHubPullRequests(
  config: GitHubConnectorConfig,
  fetcher: Fetcher = fetch,
): Promise<GitHubPullRequestSummary[]> {
  const repoConfig = getDefaultRepo(config)
  const pulls = await githubJson<GitHubPullRequestView[]>(
    `${repoConfig.apiUrl}/repos/${repoConfig.owner}/${repoConfig.repo}/pulls?state=open&per_page=30&sort=updated&direction=desc`,
    repoConfig.token,
    fetcher,
  )

  return Promise.all(
    pulls.map(async pr => {
      try {
        const detail = await githubJson<GitHubPullRequestView>(
          `${repoConfig.apiUrl}/repos/${repoConfig.owner}/${repoConfig.repo}/pulls/${pr.number}`,
          repoConfig.token,
          fetcher,
        )
        return toPullRequestSummary(detail)
      } catch {
        return toPullRequestSummary(pr)
      }
    }),
  )
}

export async function getGitHubPullRequestPreview(
  config: GitHubConnectorConfig,
  number: number,
  fetcher: Fetcher = fetch,
): Promise<GitHubPullRequestPreview> {
  const repoConfig = getDefaultRepo(config)
  const [pr, files, commits] = await Promise.all([
    githubJson<GitHubPullRequestView>(
      `${repoConfig.apiUrl}/repos/${repoConfig.owner}/${repoConfig.repo}/pulls/${number}`,
      repoConfig.token,
      fetcher,
    ),
    githubJson<GitHubPullRequestFileView[]>(
      `${repoConfig.apiUrl}/repos/${repoConfig.owner}/${repoConfig.repo}/pulls/${number}/files?per_page=100`,
      repoConfig.token,
      fetcher,
    ),
    githubJson<GitHubCommitView[]>(
      `${repoConfig.apiUrl}/repos/${repoConfig.owner}/${repoConfig.repo}/pulls/${number}/commits?per_page=100`,
      repoConfig.token,
      fetcher,
    ),
  ])
  const summary = toPullRequestSummary(pr)
  const checks = await getPullRequestChecks(repoConfig, summary.headSha, fetcher)

  return {
    ...summary,
    body: pr.body ?? undefined,
    files: files.map(file => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      patchPreview: file.patch?.slice(0, 3000),
    })),
    commitMessages: commits.map(commit => ({
      sha: commit.sha,
      message: commit.commit?.message ?? commit.sha,
      url: commit.html_url,
    })),
    checks,
    mergeRecommendation: buildMergeRecommendation(summary, checks),
  }
}

export async function mergeGitHubPullRequest(
  config: GitHubConnectorConfig,
  input: GitHubMergePullRequestInput,
  fetcher: Fetcher = fetch,
): Promise<GitHubMergePullRequestResult> {
  const repoConfig = getDefaultRepo(config)
  return await githubJson<GitHubMergePullRequestResult>(
    `${repoConfig.apiUrl}/repos/${repoConfig.owner}/${repoConfig.repo}/pulls/${input.number}/merge`,
    repoConfig.token,
    fetcher,
    {
      method: 'PUT',
      body: JSON.stringify({
        commit_title: input.title,
        commit_message: input.message,
        sha: input.sha,
        merge_method: 'squash',
      }),
    },
  )
}

export async function findGitHubIssueByTitle(
  config: GitHubConnectorConfig,
  input: { owner: string; repo: string; title: string; labels?: string[] },
  fetcher: Fetcher = fetch,
): Promise<GitHubCreatedIssue | null> {
  const token = config.token
  if (!token) throw new Error('GITHUB_TOKEN not configured')

  const params = new URLSearchParams({
    state: 'open',
    per_page: '100',
  })

  if (input.labels?.length) {
    params.set('labels', input.labels.join(','))
  }

  const response = await fetcher(
    `${config.apiUrl ?? 'https://api.github.com'}/repos/${input.owner}/${input.repo}/issues?${params.toString()}`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  )

  if (!response.ok) {
    throw new Error(`GitHub API error: HTTP ${response.status}`)
  }

  const issues = await response.json() as Array<Partial<GitHubCreatedIssue>>
  const match = issues.find(issue => issue.title === input.title && issue.id && issue.number && issue.html_url)
  return match ? match as GitHubCreatedIssue : null
}

export async function createGitHubIssue(
  config: GitHubConnectorConfig,
  input: GitHubCreateIssueInput,
  fetcher: Fetcher = fetch,
): Promise<GitHubCreatedIssue> {
  const token = config.token
  if (!token) throw new Error('GITHUB_TOKEN not configured')

  const response = await fetcher(
    `${config.apiUrl ?? 'https://api.github.com'}/repos/${input.owner}/${input.repo}/issues`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        title: input.title,
        body: input.body,
        labels: input.labels,
      }),
    },
  )

  if (!response.ok) {
    throw new Error(`GitHub API error: HTTP ${response.status}`)
  }

  const issue = await response.json() as Partial<GitHubCreatedIssue>
  if (!issue.id || !issue.number || !issue.html_url || !issue.title) {
    throw new Error('GitHub did not return a created issue')
  }

  return issue as GitHubCreatedIssue
}

export async function getGitHubConnectorHealth(
  config: GitHubConnectorConfig,
  fetcher: Fetcher = fetch,
): Promise<ConnectorHealth> {
  const token = config.token
  const owner = config.owner
  const repositories = config.repositories

  if (!token || !owner || !repositories || repositories.length === 0) {
    const missing = [
      !token ? 'token' : undefined,
      !owner ? 'owner' : undefined,
      !repositories || repositories.length === 0 ? 'repositories' : undefined,
    ].filter((field): field is string => Boolean(field))
    return missingConfigHealth(githubConnectorManifest.id, missing)
  }

  const startedAt = Date.now()

  try {
    const response = await fetcher(`${config.apiUrl ?? 'https://api.github.com'}/user`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
    const rateLimit = parseRateLimit(response.headers)

    if (response.status === 401 || response.status === 403) {
      if (rateLimit?.remaining === 0) {
        return degradedHealth(githubConnectorManifest.id, 'GitHub rate limit reached')
      }
      return errorHealth(githubConnectorManifest.id, 'GitHub authentication failed')
    }

    if (!response.ok) {
      return errorHealth(githubConnectorManifest.id, `GitHub health check failed with HTTP ${response.status}`)
    }

    return okHealth(githubConnectorManifest.id, startedAt, rateLimit)
  } catch (error) {
    return errorHealth(
      githubConnectorManifest.id,
      error instanceof Error ? error.message : 'GitHub health check failed',
    )
  }
}

export function mapGitHubPullRequestToWorkItem(
  pr: GitHubPullRequestView,
  repo: string,
  owner = 'github',
): WorkItem {
  const labels = pr.labels?.map((label) => label.name) ?? []
  const risk = inferGitHubRisk(pr.title, labels)
  const status = mapGitHubPullRequestStatus(pr)

  return {
    id: `github-pr-${pr.id}`,
    source: 'github',
    type: 'pr',
    title: `${owner}/${repo}#${pr.number}: ${pr.title}`,
    url: pr.html_url,
    projectId: `${owner}/${repo}`,
    status,
    priority: mapGitHubPriority(labels),
    blocked: hasLabel(labels, 'blocked'),
    risk,
    aiDelegable: risk !== 'C' && status === 'in-review',
    labels,
    assigneeId: pr.user?.login,
    updatedAt: pr.updated_at,
    createdAt: pr.created_at,
  }
}

export function mapGitHubIssueToWorkItem(
  issue: GitHubIssueView,
  repo: string,
  owner = 'github',
): WorkItem {
  const labels = issue.labels?.map((label) => label.name) ?? []
  const risk = inferGitHubRisk(issue.title, labels)

  return {
    id: `github-issue-${issue.id}`,
    source: 'github',
    type: 'issue',
    title: `${owner}/${repo}#${issue.number}: ${issue.title}`,
    url: issue.html_url,
    projectId: `${owner}/${repo}`,
    status: mapGitHubIssueStatus(issue.state),
    priority: mapGitHubPriority(labels),
    blocked: hasLabel(labels, 'blocked'),
    risk,
    aiDelegable: risk !== 'C' && issue.state === 'open' && !hasLabel(labels, 'blocked'),
    labels,
    assigneeId: issue.user?.login,
    updatedAt: issue.updated_at,
    createdAt: issue.created_at,
  }
}

function mapGitHubPullRequestStatus(pr: GitHubPullRequestView): WorkItemStatus {
  if (pr.merged_at) {
    return 'done'
  }
  if (pr.state === 'closed') {
    return 'cancelled'
  }
  return pr.draft ? 'in-progress' : 'in-review'
}

function mapGitHubIssueStatus(state: GitHubIssueView['state']): WorkItemStatus {
  return state === 'closed' ? 'done' : 'todo'
}

function mapGitHubPriority(labels: string[]): WorkItem['priority'] {
  if (hasLabel(labels, 'priority: urgent') || hasLabel(labels, 'p0')) {
    return 0
  }
  if (hasLabel(labels, 'priority: high') || hasLabel(labels, 'p1')) {
    return 1
  }
  if (hasLabel(labels, 'priority: low') || hasLabel(labels, 'p3')) {
    return 3
  }
  return 2
}

function inferGitHubRisk(title: string, labels: string[]): RiskClass {
  const haystack = [title, ...labels].join(' ').toLowerCase()
  if (haystack.includes('security') || haystack.includes('secret') || haystack.includes('production')) {
    return 'C'
  }
  if (haystack.includes('migration') || haystack.includes('breaking') || haystack.includes('bug')) {
    return 'B'
  }
  return 'A'
}

function hasLabel(labels: string[], wanted: string): boolean {
  return labels.some((label) => label.toLowerCase() === wanted)
}

export interface GitHubRepoCreated {
  id: number
  name: string
  full_name: string
  html_url: string
  clone_url: string
  private: boolean
}

export interface GitHubCreateRepoInput {
  /** Repository name (slug, no spaces) */
  name: string
  description?: string
  isPrivate?: boolean
  /** Create under this org instead of the authenticated user */
  org?: string
}

/**
 * Create a new GitHub repository for the authenticated user or an org.
 * Returns the created repo metadata including html_url and clone_url.
 */
export async function createGitHubRepo(
  config: GitHubConnectorConfig,
  input: GitHubCreateRepoInput,
  fetcher: Fetcher = fetch,
): Promise<GitHubRepoCreated> {
  const token = config.token?.trim()
  if (!token) throw new Error('GITHUB_TOKEN not configured')

  const apiBase = config.apiUrl ?? 'https://api.github.com'
  const endpoint = input.org
    ? `${apiBase}/orgs/${input.org}/repos`
    : `${apiBase}/user/repos`

  const response = await fetcher(endpoint, {
    method: 'POST',
    headers: githubHeaders(token),
    body: JSON.stringify({
      name: input.name,
      description: input.description ?? '',
      private: input.isPrivate ?? true,
      auto_init: true,
    }),
  })

  if (response.status === 422) {
    // Repo already exists — fetch and return it
    const owner = input.org ?? config.owner
    if (!owner) throw new Error('GitHub owner not configured')
    const existing = await fetcher(`${apiBase}/repos/${owner}/${input.name}`, {
      headers: githubHeaders(token),
    })
    if (!existing.ok) throw new Error(`GitHub API error: HTTP ${existing.status} — repo may already exist`)
    return existing.json() as Promise<GitHubRepoCreated>
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`GitHub API error: HTTP ${response.status}${text ? ` — ${text.slice(0, 200)}` : ''}`)
  }

  return response.json() as Promise<GitHubRepoCreated>
}
