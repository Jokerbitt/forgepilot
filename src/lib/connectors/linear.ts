import type { WorkItem, WorkItemStatus, RiskClass } from '@/lib/models/work-item'
import type { ConnectorHealth, ConnectorManifest } from './types'
import { degradedHealth, errorHealth, type Fetcher, missingConfigHealth, okHealth } from './shared'

export interface LinearConnectorConfig {
  apiKey?: string
  teamId?: string
  apiUrl?: string
}

interface LinearIssueView {
  id: string
  identifier: string
  title: string
  url?: string
  priority: number
  state?: {
    type?: string
    name?: string
  }
  project?: {
    id: string
  }
  team?: {
    id: string
  }
  labels?: {
    nodes?: Array<{ name: string }>
  }
  assignee?: {
    id: string
    name?: string
    avatarUrl?: string
  }
  estimate?: number
  updatedAt: string
  createdAt: string
}

export const linearConnectorManifest: ConnectorManifest = {
  id: 'linear',
  name: 'Linear',
  category: 'pm',
  authType: 'api-key',
  capabilities: ['read-items', 'write-items', 'read-comments', 'write-comments'],
  configSchema: {
    apiKey: {
      type: 'secret',
      label: 'API Key',
      required: true,
      description: 'Linear personal API key',
      placeholder: 'lin_api_...',
    },
    teamId: {
      type: 'string',
      label: 'Team ID',
      required: true,
      description: 'Linear team identifier used to scope synced issues',
    },
  },
  docsUrl: 'https://developers.linear.app/docs/graphql/working-with-the-graphql-api',
}

export async function getLinearConnectorHealth(
  config: LinearConnectorConfig,
  fetcher: Fetcher = fetch,
): Promise<ConnectorHealth> {
  const apiKey = config.apiKey
  const teamId = config.teamId

  if (!apiKey || !teamId) {
    const missing = [
      !apiKey ? 'apiKey' : undefined,
      !teamId ? 'teamId' : undefined,
    ].filter((field): field is string => Boolean(field))
    return missingConfigHealth(linearConnectorManifest.id, missing)
  }

  const startedAt = Date.now()

  try {
    const response = await fetcher(config.apiUrl ?? 'https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: apiKey,
      },
      body: JSON.stringify({
        query: 'query ConnectorHealth($teamId: String!) { team(id: $teamId) { id name } viewer { id } }',
        variables: { teamId },
      }),
    })

    if (response.status === 429) {
      return degradedHealth(linearConnectorManifest.id, 'Linear rate limit reached')
    }

    if (response.status === 401 || response.status === 403) {
      return errorHealth(linearConnectorManifest.id, 'Linear authentication failed')
    }

    if (!response.ok) {
      return errorHealth(linearConnectorManifest.id, `Linear health check failed with HTTP ${response.status}`)
    }

    const payload: unknown = await response.json()
    if (hasGraphQlErrors(payload)) {
      return errorHealth(linearConnectorManifest.id, 'Linear GraphQL health check returned errors')
    }

    return okHealth(linearConnectorManifest.id, startedAt)
  } catch (error) {
    return errorHealth(
      linearConnectorManifest.id,
      error instanceof Error ? error.message : 'Linear health check failed',
    )
  }
}

export function mapLinearIssueToWorkItem(issue: LinearIssueView): WorkItem {
  const labels = issue.labels?.nodes?.map((label) => label.name) ?? []
  const status = mapLinearStatus(issue.state?.type)
  const priority = mapLinearPriority(issue.priority)
  const risk = inferLinearRisk(issue.title, labels, priority)

  return {
    id: issue.id,
    source: 'linear',
    type: 'ticket',
    title: issue.identifier ? `${issue.identifier}: ${issue.title}` : issue.title,
    url: issue.url ?? '',
    projectId: issue.project?.id ?? issue.team?.id ?? 'linear',
    status,
    priority,
    blocked: labels.some((label) => label.toLowerCase() === 'blocked'),
    risk,
    aiDelegable: risk !== 'C' && status !== 'done' && status !== 'cancelled',
    labels,
    assigneeId: issue.assignee?.id,
    assigneeName: issue.assignee?.name,
    assigneeAvatarUrl: issue.assignee?.avatarUrl,
    estimate: issue.estimate,
    updatedAt: issue.updatedAt,
    createdAt: issue.createdAt,
  }
}

function mapLinearStatus(stateType?: string): WorkItemStatus {
  switch (stateType) {
    case 'backlog':
      return 'backlog'
    case 'started':
      return 'in-progress'
    case 'completed':
      return 'done'
    case 'canceled':
      return 'cancelled'
    case 'unstarted':
    case 'triage':
    default:
      return 'todo'
  }
}

function mapLinearPriority(priority: number): WorkItem['priority'] {
  switch (priority) {
    case 1:
      return 0
    case 2:
      return 1
    case 3:
      return 2
    case 4:
      return 3
    case 0:
    default:
      return 4
  }
}

function inferLinearRisk(title: string, labels: string[], priority: WorkItem['priority']): RiskClass {
  const haystack = [title, ...labels].join(' ').toLowerCase()
  if (haystack.includes('security') || haystack.includes('secret') || haystack.includes('production')) {
    return 'C'
  }
  if (priority <= 1 || haystack.includes('migration') || haystack.includes('breaking')) {
    return 'B'
  }
  return 'A'
}

export interface LinearCreateIssueInput {
  teamId: string
  title: string
  description?: string
  priority?: number
}

export interface LinearCreatedIssue {
  id: string
  identifier: string
  url: string
}

export async function createLinearIssue(
  config: LinearConnectorConfig,
  input: LinearCreateIssueInput,
  fetcher: Fetcher = fetch,
): Promise<LinearCreatedIssue> {
  const apiKey = config.apiKey
  if (!apiKey) throw new Error('LINEAR_API_KEY not configured')

  const mutation = `
    mutation CreateIssue($teamId: String!, $title: String!, $description: String, $priority: Int) {
      issueCreate(input: { teamId: $teamId, title: $title, description: $description, priority: $priority }) {
        success
        issue { id identifier url }
      }
    }
  `

  const response = await fetcher(config.apiUrl ?? 'https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey,
    },
    body: JSON.stringify({
      query: mutation,
      variables: {
        teamId: input.teamId,
        title: input.title,
        description: input.description,
        priority: input.priority,
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Linear API error: HTTP ${response.status}`)
  }

  const payload = await response.json() as {
    data?: { issueCreate?: { success: boolean; issue?: LinearCreatedIssue } }
    errors?: unknown[]
  }

  if (payload.errors?.length) {
    throw new Error(`Linear GraphQL error: ${JSON.stringify(payload.errors)}`)
  }

  const issue = payload.data?.issueCreate?.issue
  if (!issue) throw new Error('Linear did not return a created issue')

  return issue
}

function hasGraphQlErrors(payload: unknown): boolean {
  return typeof payload === 'object' && payload !== null && 'errors' in payload
}
