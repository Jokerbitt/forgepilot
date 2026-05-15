import { describe, expect, it } from 'vitest'
import { parseRepositoryList, readConnectorConfigsFromEnv, readGitHubConfigFromEnv } from './config'

describe('parseRepositoryList', () => {
  it('parses comma-separated repository names', () => {
    expect(parseRepositoryList('forgepilot, daily-briefing')).toEqual(['forgepilot', 'daily-briefing'])
  })

  it('returns undefined for empty input', () => {
    expect(parseRepositoryList(' , ')).toBeUndefined()
    expect(parseRepositoryList(undefined)).toBeUndefined()
  })
})

describe('connector env config readers', () => {
  it('reads GitHub owner from GITHUB_OWNER first', () => {
    const config = readGitHubConfigFromEnv({
      GITHUB_TOKEN: 'token',
      GITHUB_OWNER: 'Jokerbitt',
      GITHUB_REPOSITORY_OWNER: 'Other',
      GITHUB_REPOSITORIES: 'forgepilot',
    })

    expect(config.owner).toBe('Jokerbitt')
    expect(config.repositories).toEqual(['forgepilot'])
  })

  it('builds the full connector config map without exposing secrets elsewhere', () => {
    const configs = readConnectorConfigsFromEnv({
      LINEAR_API_KEY: 'lin_api_test',
      LINEAR_TEAM_ID: 'team-1',
      GITHUB_TOKEN: 'ghp_test',
      GITHUB_OWNER: 'Jokerbitt',
      GITHUB_REPOSITORIES: 'forgepilot,daily-briefing',
    })

    expect(configs.linear?.teamId).toBe('team-1')
    expect(configs.github?.repositories).toEqual(['forgepilot', 'daily-briefing'])
  })
})
