import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { readConnectorConfigs } from '@/lib/connectors/config'
import { createGitHubIssue, findGitHubIssueByTitle } from '@/lib/connectors/github'
import { readProjectBriefs } from '@/lib/project-briefs'
import { getWorkPackagesByBriefId } from '@/lib/knowledge/milestone-store'
import { logger } from '@/lib/logger'

const CreateIssuesSchema = z.object({
  /** ProjectBrief ID — issues are created in the brief's linked GitHub repo */
  briefId: z.string().min(1),
  /** Create issues only for specific work package IDs (default: all pending) */
  workPackageIds: z.array(z.string()).optional(),
  /** Labels to apply to all created issues */
  labels: z.array(z.string()).default(['forgepilot']),
  /** Override owner (defaults to config owner) */
  owner: z.string().optional(),
  /** Override repo (defaults to brief's githubRepoName or config repo) */
  repo: z.string().optional(),
})

/**
 * POST /api/github/issues
 * Create GitHub issues for the work packages of a ProjectBrief.
 * Skips work packages that already have a matching issue (idempotent).
 */
export async function POST(request: NextRequest) {
  const body = await parseBody(request, CreateIssuesSchema)
  if (isValidationError(body)) return body

  const { briefId, workPackageIds, labels, owner: ownerOverride, repo: repoOverride } = body

  const brief = readProjectBriefs().find(b => b.id === briefId)
  if (!brief) {
    return NextResponse.json({ error: 'ProjectBrief not found' }, { status: 404 })
  }

  const { github: ghConfig } = readConnectorConfigs()
  if (!ghConfig?.token?.trim()) {
    return NextResponse.json(
      { error: 'GitHub not connected — set GITHUB_TOKEN in Settings' },
      { status: 424 },
    )
  }

  // Resolve owner + repo from brief's linked GitHub repo or config defaults
  const repoName = repoOverride ?? brief.githubRepoName?.split('/')?.[1] ?? ghConfig.repositories?.[0]?.trim()
  const owner = ownerOverride ?? brief.githubRepoName?.split('/')?.[0] ?? ghConfig.owner?.trim()
  if (!owner || !repoName) {
    return NextResponse.json(
      { error: 'No GitHub repository linked to this brief. Create one first via POST /api/github/repos.' },
      { status: 422 },
    )
  }

  const workPackages = getWorkPackagesByBriefId(briefId)
  const filtered = workPackageIds
    ? workPackages.filter(wp => workPackageIds.includes(wp.id))
    : workPackages.filter(wp => wp.status !== 'done')

  if (filtered.length === 0) {
    return NextResponse.json({ created: [], skipped: [], message: 'No pending work packages found' })
  }

  const created: Array<{ workPackageId: string; issueNumber: number; url: string; title: string }> = []
  const skipped: Array<{ workPackageId: string; reason: string }> = []

  for (const wp of filtered) {
    try {
      // Idempotency: skip if an issue with the same title already exists
      const existing = await findGitHubIssueByTitle(ghConfig, { owner, repo: repoName, title: wp.title })
      if (existing) {
        skipped.push({ workPackageId: wp.id, reason: `Issue already exists: #${existing.number}` })
        continue
      }

      const body = [
        `**Work Package:** ${wp.id}`,
        `**ForgePilot Brief:** ${briefId}`,
        `**Risk Class:** ${wp.riskClass}`,
        `**Estimated Hours:** ${wp.estimatedHours}h`,
        '',
        '## Description',
        wp.description,
        '',
        '## Definition of Done',
        wp.definitionOfDone.map(d => `- [ ] ${d}`).join('\n'),
        '',
        wp.tags.length > 0 ? `**Tags:** ${wp.tags.join(', ')}` : '',
      ].filter(Boolean).join('\n')

      const issue = await createGitHubIssue(ghConfig, {
        owner,
        repo: repoName,
        title: wp.title,
        body,
        labels: [...labels, `risk-${wp.riskClass.toLowerCase()}`, ...wp.tags.slice(0, 2)],
      })

      created.push({ workPackageId: wp.id, issueNumber: issue.number, url: issue.html_url, title: issue.title })
      logger.info({ event: 'github.issue.created', issueNumber: issue.number, workPackageId: wp.id, briefId })
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      skipped.push({ workPackageId: wp.id, reason: msg })
      logger.warn({ event: 'github.issue.create.failed', error: msg, workPackageId: wp.id, briefId })
    }
  }

  return NextResponse.json({ created, skipped }, { status: created.length > 0 ? 201 : 200 })
}

/**
 * GET /api/github/issues?briefId=xxx
 * List GitHub issues linked to a brief's repo (first 30).
 */
export async function GET(request: NextRequest) {
  const briefId = request.nextUrl.searchParams.get('briefId')
  if (!briefId) return NextResponse.json({ error: 'briefId required' }, { status: 400 })

  const brief = readProjectBriefs().find(b => b.id === briefId)
  if (!brief) return NextResponse.json({ error: 'ProjectBrief not found' }, { status: 404 })

  const { github: ghConfig } = readConnectorConfigs()
  if (!ghConfig?.token?.trim()) {
    return NextResponse.json({ error: 'GitHub not connected' }, { status: 424 })
  }

  const repoName = brief.githubRepoName?.split('/')?.[1] ?? ghConfig.repositories?.[0]?.trim()
  const owner = brief.githubRepoName?.split('/')?.[0] ?? ghConfig.owner?.trim()
  if (!owner || !repoName) {
    return NextResponse.json({ issues: [], repoUrl: null })
  }

  try {
    const apiBase = ghConfig.apiUrl ?? 'https://api.github.com'
    const res = await fetch(
      `${apiBase}/repos/${owner}/${repoName}/issues?state=open&per_page=30&labels=forgepilot`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${ghConfig.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    )
    if (!res.ok) return NextResponse.json({ issues: [], repoUrl: brief.githubRepoUrl ?? null })
    const issues = await res.json() as Array<{ number: number; title: string; html_url: string; state: string; labels: Array<{ name: string }> }>
    return NextResponse.json({
      issues: issues.map(i => ({
        number: i.number,
        title: i.title,
        url: i.html_url,
        state: i.state,
        labels: i.labels.map(l => l.name),
      })),
      repoUrl: brief.githubRepoUrl ?? null,
    })
  } catch {
    return NextResponse.json({ issues: [], repoUrl: brief.githubRepoUrl ?? null })
  }
}
