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
  labels?: Array<{ name: string }>
  user?: GitHubUserItem | null
  updated_at: string
  created_at: string
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
