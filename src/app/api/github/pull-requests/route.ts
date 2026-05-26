import { NextResponse } from 'next/server'
import { readConnectorConfigs } from '@/lib/connectors/config'
import { listGitHubPullRequests } from '@/lib/connectors/github'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const configs = readConnectorConfigs()
    const pullRequests = await listGitHubPullRequests(configs.github ?? {})
    return NextResponse.json({
      repository: {
        owner: configs.github?.owner ?? 'Jokerbitt',
        name: configs.github?.repositories?.[0] ?? 'forgepilot',
      },
      pullRequests,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'GitHub pull requests could not be loaded'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
