import type { WorkItem } from '@/lib/models/work-item'
import { mapGitHubPullRequestToWorkItem, mapGitHubIssueToWorkItem, type GitHubConnectorConfig } from './github'
import type { Fetcher } from './shared'

export async function fetchGitHubWorkItems(
  config: GitHubConnectorConfig,
  fetcher: Fetcher = fetch,
): Promise<WorkItem[]> {
  if (!config.token || !config.owner || !config.repositories || config.repositories.length === 0) {
    return []
  }

  const baseUrl = config.apiUrl ?? 'https://api.github.com'
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${config.token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  }

  const allItems: WorkItem[] = []

  await Promise.all(
    config.repositories.map(async (repo) => {
      const [prsResponse, issuesResponse] = await Promise.all([
        fetcher(`${baseUrl}/repos/${config.owner}/${repo}/pulls?state=open&per_page=50`, { headers }),
        fetcher(`${baseUrl}/repos/${config.owner}/${repo}/issues?state=open&per_page=50`, { headers }),
      ])

      if (prsResponse.ok) {
        const prs = (await prsResponse.json()) as unknown[]
        for (const pr of prs) {
          allItems.push(
            mapGitHubPullRequestToWorkItem(
              pr as Parameters<typeof mapGitHubPullRequestToWorkItem>[0],
              repo,
              config.owner,
            ),
          )
        }
      }

      if (issuesResponse.ok) {
        const issues = (await issuesResponse.json()) as Array<{ pull_request?: unknown }>
        for (const issue of issues) {
          // GitHub Issues API returns PRs too — skip those (already fetched above)
          if (issue.pull_request) continue
          allItems.push(
            mapGitHubIssueToWorkItem(
              issue as Parameters<typeof mapGitHubIssueToWorkItem>[0],
              repo,
              config.owner,
            ),
          )
        }
      }
    }),
  )

  return allItems
}
