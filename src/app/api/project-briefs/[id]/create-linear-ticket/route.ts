export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { findProjectBriefById } from '@/lib/project-briefs'
import { createLinearIssue } from '@/lib/connectors/linear'
import { readConnectorConfigs } from '@/lib/connectors/config'

type RouteParams = { params: { id: string } }

function buildLinearDescription(brief: {
  rawIdea: string
  problemStatement: string
  desiredOutcome: string
  targetAudience: string
  requirements: Array<{ status: string; priority: string; title: string; description: string }>
}): string {
  const accepted = brief.requirements.filter(r => r.status === 'accepted')
  const lines: string[] = [
    `## Idee`,
    brief.rawIdea,
    '',
    `## Problem`,
    brief.problemStatement,
    '',
    `## Zielgruppe`,
    brief.targetAudience,
    '',
    `## Gewünschter Zielzustand`,
    brief.desiredOutcome,
  ]

  if (accepted.length > 0) {
    lines.push('', '## Akzeptierte Requirements')
    for (const req of accepted) {
      lines.push(`- **[${req.priority}]** ${req.title}: ${req.description}`)
    }
  }

  lines.push('', `---`, `*Erstellt via ForgePilot Blueprint*`)
  return lines.join('\n')
}

export async function POST(_req: Request, { params }: RouteParams) {
  const brief = findProjectBriefById(params.id)
  if (!brief) {
    return NextResponse.json({ error: 'Brief not found' }, { status: 404 })
  }

  const config = readConnectorConfigs()
  const apiKey = config.linear?.apiKey
  const teamId = config.linear?.teamId

  if (!apiKey) {
    return NextResponse.json(
      { error: 'LINEAR_API_KEY nicht konfiguriert. Bitte in den Einstellungen eintragen.' },
      { status: 503 },
    )
  }
  if (!teamId) {
    return NextResponse.json(
      { error: 'LINEAR_TEAM_ID nicht konfiguriert. Bitte als Umgebungsvariable setzen.' },
      { status: 503 },
    )
  }

  try {
    const issue = await createLinearIssue({ apiKey, teamId }, {
      teamId,
      title: brief.title,
      description: buildLinearDescription(brief),
      priority: 2,
    })

    return NextResponse.json({ issueId: issue.id, identifier: issue.identifier, url: issue.url })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Linear-Ticket konnte nicht erstellt werden' },
      { status: 500 },
    )
  }
}
