import type { WorkItem } from '@/lib/models/work-item'
import { mapLinearIssueToWorkItem, type LinearConnectorConfig } from './linear'
import type { Fetcher } from './shared'

const ISSUES_QUERY = `
  query FetchTeamIssues($teamId: String!, $first: Int!) {
    issues(filter: { team: { id: { eq: $teamId } } }, first: $first, orderBy: updatedAt) {
      nodes {
        id
        identifier
        title
        url
        priority
        state { type name }
        project { id }
        team { id }
        labels { nodes { name } }
        assignee { id }
        updatedAt
        createdAt
      }
    }
  }
`

export async function fetchLinearWorkItems(
  config: LinearConnectorConfig,
  limit = 50,
  fetcher: Fetcher = fetch,
): Promise<WorkItem[]> {
  if (!config.apiKey || !config.teamId) {
    return []
  }

  const response = await fetcher(config.apiUrl ?? 'https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: config.apiKey,
    },
    body: JSON.stringify({
      query: ISSUES_QUERY,
      variables: { teamId: config.teamId, first: limit },
    }),
  })

  if (!response.ok) {
    throw new Error(`Linear API returned HTTP ${response.status}`)
  }

  const payload = (await response.json()) as {
    data?: { issues?: { nodes?: unknown[] } }
    errors?: unknown[]
  }

  if (payload.errors && payload.errors.length > 0) {
    throw new Error('Linear GraphQL returned errors')
  }

  const nodes = payload.data?.issues?.nodes ?? []
  return nodes.map((node) => mapLinearIssueToWorkItem(node as Parameters<typeof mapLinearIssueToWorkItem>[0]))
}
