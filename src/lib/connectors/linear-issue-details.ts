import { readStoredApiKeys } from './config'

export interface LinearIssueDetails {
  title: string
  description: string
  labels: string[]
  url: string
}

interface LinearIssueDetailsResponse {
  data?: {
    issue?: {
      id: string
      identifier: string
      title: string
      description: string | null
      url: string
      labels?: { nodes?: Array<{ name: string }> }
    } | null
  }
  errors?: Array<{ message: string }>
}

const ISSUE_DETAILS_QUERY = `
  query IssueDetails($identifier: String!) {
    issue(id: $identifier) {
      id
      identifier
      title
      description
      url
      labels { nodes { name } }
    }
  }
`

/**
 * Fetch a Linear issue's title, description, labels and url by its identifier
 * (e.g. "ENG-42"). Returns null when the key is missing, the identifier does
 * not match the Linear format, the issue cannot be resolved, or the request
 * fails for any reason. This is intentional so callers can silently degrade.
 */
export async function fetchLinearIssueDetails(
  workItemId: string,
  fetcher: typeof fetch = fetch,
): Promise<LinearIssueDetails | null> {
  if (!workItemId || !/^[A-Z]+-\d+$/i.test(workItemId)) {
    return null
  }

  const stored = readStoredApiKeys()
  const apiKey = (process.env.LINEAR_API_KEY || stored.LINEAR_API_KEY)?.trim()
  if (!apiKey) return null

  try {
    const response = await fetcher('https://api.linear.app/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: apiKey },
      body: JSON.stringify({
        query: ISSUE_DETAILS_QUERY,
        variables: { identifier: workItemId },
      }),
    })

    if (!response.ok) return null

    const payload = (await response.json()) as LinearIssueDetailsResponse

    if (payload.errors?.length) return null
    const issue = payload.data?.issue
    if (!issue) return null

    return {
      title: issue.title,
      description: issue.description ?? '',
      labels: issue.labels?.nodes?.map((label) => label.name) ?? [],
      url: issue.url ?? '',
    }
  } catch {
    return null
  }
}
