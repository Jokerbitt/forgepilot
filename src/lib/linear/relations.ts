/**
 * relations.ts — JOK-22
 *
 * GraphQL queries for Linear issueRelations (blocks / blocked-by).
 * Uses native fetch, no SDK. Fail-open: returns [] on any error.
 */

import { readStoredApiKeys } from '@/lib/connectors/config'

const LINEAR_API = 'https://api.linear.app/graphql'

/** Returns the Linear API key from env or config/api-keys.json (UI-stored). */
function getLinearApiKey(): string {
  return process.env.LINEAR_API_KEY ?? readStoredApiKeys().LINEAR_API_KEY ?? ''
}

export interface IssueRelation {
  id: string
  type: 'blocks' | 'blocked_by' | 'duplicate' | 'related'
  relatedIssue: {
    id: string
    identifier: string
    title: string
    status: string
  }
}

export interface IssueWithRelations {
  id: string
  identifier: string
  title: string
  status: string
  priority: number
  relations: IssueRelation[]
}

interface GQLRelatedIssue {
  id: string
  identifier: string
  title: string
  state: { name: string }
}

interface GQLRelationNode {
  id: string
  type: string
  relatedIssue: GQLRelatedIssue
}

interface GQLIssueNode {
  id: string
  identifier: string
  title: string
  priority: number
  state: { name: string; type: string }
  relations: { nodes: GQLRelationNode[] }
}

interface GQLTeamResponse {
  data?: {
    team?: {
      issues?: {
        nodes: GQLIssueNode[]
      }
    }
  }
  errors?: Array<{ message: string }>
}

const ISSUE_RELATIONS_QUERY = `
  query IssueRelations($teamId: String!, $first: Int) {
    team(id: $teamId) {
      issues(first: $first, filter: { state: { type: { nin: ["completed", "cancelled"] } } }) {
        nodes {
          id
          identifier
          title
          priority
          state { name type }
          relations {
            nodes {
              id
              type
              relatedIssue {
                id
                identifier
                title
                state { name }
              }
            }
          }
        }
      }
    }
  }
`

function isValidRelationType(
  type: string,
): type is 'blocks' | 'blocked_by' | 'duplicate' | 'related' {
  return ['blocks', 'blocked_by', 'duplicate', 'related'].includes(type)
}

function mapRelationNode(node: GQLRelationNode): IssueRelation {
  const type = isValidRelationType(node.type) ? node.type : 'related'
  return {
    id: node.id,
    type,
    relatedIssue: {
      id: node.relatedIssue.id,
      identifier: node.relatedIssue.identifier,
      title: node.relatedIssue.title,
      status: node.relatedIssue.state?.name ?? 'Unknown',
    },
  }
}

/**
 * Fetch all active issues for a team along with their block/blocked-by relations.
 * Returns [] when LINEAR_API_KEY is missing, on network errors, or on API errors.
 */
export async function fetchIssueRelations(
  teamId: string,
  limit = 100,
): Promise<IssueWithRelations[]> {
  const apiKey = getLinearApiKey()
  if (!apiKey) {
    return []
  }

  try {
    const res = await fetch(LINEAR_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: apiKey,
      },
      body: JSON.stringify({
        query: ISSUE_RELATIONS_QUERY,
        variables: { teamId, first: limit },
      }),
    })

    if (!res.ok) {
      return []
    }

    const data = (await res.json()) as GQLTeamResponse

    if (data.errors && data.errors.length > 0) {
      return []
    }

    const nodes = data.data?.team?.issues?.nodes ?? []

    return nodes.map((node): IssueWithRelations => ({
      id: node.id,
      identifier: node.identifier,
      title: node.title,
      status: node.state?.name ?? 'Unknown',
      priority: node.priority,
      relations: (node.relations?.nodes ?? []).map(mapRelationNode),
    }))
  } catch {
    return []
  }
}

/**
 * Fetch relations for a specific set of issue IDs.
 * Returns only the relation records (blocks / blocked_by) filtered to the provided IDs.
 */
export async function fetchBlockingRelations(
  issueIds: string[],
): Promise<IssueRelation[]> {
  if (issueIds.length === 0) return []

  const apiKey = getLinearApiKey()
  if (!apiKey) return []

  try {
    // Re-use fetchIssueRelations with a broad query, then filter
    // Linear doesn't expose an issues(ids: [...]) filter directly in all versions,
    // so we use a per-issue query approach via the issue() root field.
    const ISSUE_RELATIONS_BY_ID_QUERY = `
      query IssueRelationsById($id: String!) {
        issue(id: $id) {
          id
          identifier
          title
          priority
          state { name type }
          relations {
            nodes {
              id
              type
              relatedIssue {
                id
                identifier
                title
                state { name }
              }
            }
          }
        }
      }
    `

    const idSet = new Set(issueIds)
    const results: IssueRelation[] = []

    await Promise.all(
      issueIds.map(async (id) => {
        try {
          const res = await fetch(LINEAR_API, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: apiKey,
            },
            body: JSON.stringify({
              query: ISSUE_RELATIONS_BY_ID_QUERY,
              variables: { id },
            }),
          })
          if (!res.ok) return

          const data = (await res.json()) as {
            data?: {
              issue?: {
                relations?: { nodes: GQLRelationNode[] }
              }
            }
          }

          const nodes = data.data?.issue?.relations?.nodes ?? []
          for (const node of nodes) {
            if (idSet.has(node.relatedIssue.id) || idSet.has(id)) {
              results.push(mapRelationNode(node))
            }
          }
        } catch {
          // Fail-open per issue
        }
      }),
    )

    return results
  } catch {
    return []
  }
}
