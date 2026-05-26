/**
 * Linear API Client — M214
 *
 * Provides GraphQL-based access to Linear issues.
 * Used for bidirectional sync: close Linear tickets when linked PRs merge.
 */

import { readStoredApiKeys } from '@/lib/connectors/config'

const LINEAR_API = 'https://api.linear.app/graphql'

export interface LinearIssue {
  id: string
  identifier: string
  title: string
  state: { name: string; type: string }
}

export interface LinearCreatedIssue {
  id: string
  identifier: string
  url: string
}

export class LinearClient {
  constructor(private apiKey: string) {}

  async getTeamId(): Promise<string | null> {
    const res = await fetch(LINEAR_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: this.apiKey },
      body: JSON.stringify({ query: `query { teams { nodes { id name } } }` }),
    })
    if (!res.ok) return null
    const data = await res.json() as { data?: { teams?: { nodes: Array<{ id: string; name: string }> } } }
    return data.data?.teams?.nodes?.[0]?.id ?? null
  }

  async createIssue(params: {
    title: string
    description: string
    teamId?: string
    projectId?: string
  }): Promise<{ id: string; identifier: string; url: string } | null> {
    const teamId = params.teamId ?? await this.getTeamId()
    if (!teamId) return null
    const res = await fetch(LINEAR_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: this.apiKey },
      body: JSON.stringify({
        query: `mutation CreateIssue($teamId: String!, $title: String!, $description: String, $projectId: String) {
          issueCreate(input: { teamId: $teamId, title: $title, description: $description, projectId: $projectId }) {
            success
            issue { id identifier url }
          }
        }`,
        variables: { teamId, title: params.title, description: params.description, projectId: params.projectId ?? null },
      }),
    })
    if (!res.ok) return null
    const data = await res.json() as {
      data?: { issueCreate?: { success: boolean; issue?: { id: string; identifier: string; url: string } } }
    }
    return data.data?.issueCreate?.issue ?? null
  }

  async getIssue(issueId: string): Promise<LinearIssue | null> {
    const res = await fetch(LINEAR_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.apiKey,
      },
      body: JSON.stringify({
        query: `query Issue($id: String!) {
          issue(id: $id) {
            id
            identifier
            title
            state { name type }
          }
        }`,
        variables: { id: issueId },
      }),
    })
    if (!res.ok) return null
    const data = await res.json() as { data?: { issue?: LinearIssue } }
    return data.data?.issue ?? null
  }

  async closeIssue(issueId: string): Promise<boolean> {
    // First get the "Done" state ID for this team
    const stateRes = await fetch(LINEAR_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.apiKey,
      },
      body: JSON.stringify({
        query: `query { workflowStates(filter: { type: { eq: "completed" } }) { nodes { id name } } }`,
      }),
    })
    if (!stateRes.ok) return false
    const stateData = await stateRes.json() as { data?: { workflowStates?: { nodes: Array<{ id: string; name: string }> } } }
    const states = stateData.data?.workflowStates?.nodes ?? []
    const doneState = states.find(s => s.name === 'Done') ?? states[0]
    if (!doneState) return false

    const res = await fetch(LINEAR_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.apiKey,
      },
      body: JSON.stringify({
        query: `mutation CloseIssue($id: String!, $stateId: String!) {
          issueUpdate(id: $id, input: { stateId: $stateId }) {
            success
          }
        }`,
        variables: { id: issueId, stateId: doneState.id },
      }),
    })
    if (!res.ok) return false
    const data = await res.json() as { data?: { issueUpdate?: { success: boolean } } }
    return data.data?.issueUpdate?.success ?? false
  }
}

export function extractLinearIssueIds(text: string): string[] {
  // Matches: FP-123, FORGE-456, etc.
  const matches = text.matchAll(/\b([A-Z]{2,10}-\d+)\b/g)
  return [...new Set([...matches].map(m => m[1]))]
}

export function createLinearClient(): LinearClient | null {
  const key = process.env.LINEAR_API_KEY ?? readStoredApiKeys().LINEAR_API_KEY
  if (!key) return null
  return new LinearClient(key)
}
