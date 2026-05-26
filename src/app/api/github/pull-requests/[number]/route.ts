import { NextResponse } from 'next/server'
import { readConnectorConfigs } from '@/lib/connectors/config'
import { getGitHubPullRequestPreview } from '@/lib/connectors/github'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ number: string }>
}

export async function GET(_request: Request, { params }: Params) {
  const { number: rawNumber } = await params
  const number = Number(rawNumber)
  if (!Number.isInteger(number) || number <= 0) {
    return NextResponse.json({ error: 'Invalid pull request number' }, { status: 400 })
  }

  try {
    const configs = readConnectorConfigs()
    const preview = await getGitHubPullRequestPreview(configs.github ?? {}, number)
    return NextResponse.json(preview)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'GitHub pull request could not be loaded'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
