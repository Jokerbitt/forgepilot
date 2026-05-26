import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { readConnectorConfigs } from '@/lib/connectors/config'
import { createGitHubRepo } from '@/lib/connectors/github'
import { readProjectBriefs, updateProjectBrief, saveProjectBrief } from '@/lib/project-briefs'
import { logger } from '@/lib/logger'

const CreateRepoSchema = z.object({
  /** ProjectBrief ID — the repo URL will be stored back on the brief */
  briefId: z.string().min(1),
  /** Repo slug, defaults to a slug derived from the brief title */
  name: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/, 'Only alphanumeric, dash, dot, underscore').optional(),
  description: z.string().max(300).optional(),
  /** true = private (default), false = public */
  isPrivate: z.boolean().default(true),
  /** GitHub org to create under (defaults to owner in config) */
  org: z.string().optional(),
})

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'project'
}

/**
 * POST /api/github/repos
 * Create a new GitHub repository for the given ProjectBrief.
 * Stores the repo URL + full_name back on the brief (githubRepoUrl, githubRepoName).
 */
export async function POST(request: NextRequest) {
  const body = await parseBody(request, CreateRepoSchema)
  if (isValidationError(body)) return body

  const { briefId, name, description, isPrivate, org } = body

  const brief = readProjectBriefs().find(b => b.id === briefId)
  if (!brief) {
    return NextResponse.json({ error: 'ProjectBrief not found' }, { status: 404 })
  }

  if (brief.githubRepoUrl) {
    return NextResponse.json({
      repoUrl: brief.githubRepoUrl,
      repoName: brief.githubRepoName,
      alreadyExists: true,
    })
  }

  const { github: githubConfig } = readConnectorConfigs()
  if (!githubConfig?.token?.trim()) {
    return NextResponse.json(
      { error: 'GitHub not connected — set GITHUB_TOKEN in Settings' },
      { status: 424 },
    )
  }

  const repoName = name ?? slugify(brief.title)

  try {
    const created = await createGitHubRepo(githubConfig, {
      name: repoName,
      description: description ?? brief.problemStatement?.slice(0, 200) ?? brief.rawIdea?.slice(0, 200),
      isPrivate,
      org,
    })

    const updated = updateProjectBrief(brief.id, {
      githubRepoUrl: created.html_url,
      githubRepoName: created.full_name,
    })
    if (updated) saveProjectBrief(updated)

    logger.info({ event: 'github.repo.created', repoUrl: created.html_url, briefId }, 'GitHub repo created for project')

    return NextResponse.json({
      repoUrl: created.html_url,
      repoName: created.full_name,
      cloneUrl: created.clone_url,
      private: created.private,
      alreadyExists: false,
    }, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error({ event: 'github.repo.create.failed', error: msg, briefId }, 'GitHub repo creation failed')
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * GET /api/github/repos?briefId=xxx
 * Returns the linked GitHub repo for a brief (if any).
 */
export async function GET(request: NextRequest) {
  const briefId = request.nextUrl.searchParams.get('briefId')
  if (!briefId) return NextResponse.json({ error: 'briefId required' }, { status: 400 })

  const brief = readProjectBriefs().find(b => b.id === briefId)
  if (!brief) return NextResponse.json({ error: 'ProjectBrief not found' }, { status: 404 })

  return NextResponse.json({
    repoUrl: brief.githubRepoUrl ?? null,
    repoName: brief.githubRepoName ?? null,
  })
}
