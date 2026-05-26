export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { saveSnapshot } from '@/lib/project-briefs/brief-versions'
import { createProjectBriefRepository } from '@/lib/repositories/projectBriefRepository'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { ProjectBriefPatchSchema } from '@/lib/validation/schemas'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params
  try {
    const repo = createProjectBriefRepository()
    const brief = await repo.findById(id)
    if (!brief) {
      return NextResponse.json({ error: 'Project brief not found' }, { status: 404 })
    }
    return NextResponse.json(brief)
  } catch {
    return NextResponse.json({ error: 'Failed to read project brief' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params
  try {
    const patch = await parseBody(request, ProjectBriefPatchSchema)
    if (isValidationError(patch)) return patch

    const repo = createProjectBriefRepository()
    const current = await repo.findById(id)
    if (!current) {
      return NextResponse.json({ error: 'Project brief not found' }, { status: 404 })
    }
    saveSnapshot(current, 'Automatisch vor Update')
    const updated = await repo.update(id, patch)

    // M217: Fire-and-forget — create Linear project + ticket when brief is accepted
    if (patch.status === 'accepted' && updated) {
      // First create (or find) a Linear project for this brief, then link the ticket
      void (async () => {
        try {
          const { readConnectorConfigs } = await import('@/lib/connectors/config')
          const { linear: linearConfig } = readConnectorConfigs()
          const teamId = linearConfig?.teamId?.trim()
          const apiKey = linearConfig?.apiKey?.trim()
          if (!teamId || !apiKey) return

          const { findOrCreateLinearProject } = await import('@/lib/connectors/linear')
          const { updateProjectBrief, saveProjectBrief, readProjectBriefs } = await import('@/lib/project-briefs')

          const project = await findOrCreateLinearProject(linearConfig!, {
            teamId,
            name: updated.title,
            description: [updated.problemStatement, `Outcome: ${updated.desiredOutcome}`].join('\n'),
          })

          const latest = readProjectBriefs().find(b => b.id === updated.id)
          if (latest && !latest.linearProjectId) {
            const patched = updateProjectBrief(latest.id, {
              linearProjectId: project.id,
              linearProjectUrl: project.url,
            })
            if (patched) saveProjectBrief(patched)
          }

          // Create the overview ticket linked to the project
          const { createLinearTicketForBrief } = await import('@/lib/linear/create-ticket')
          await createLinearTicketForBrief({
            title: updated.title,
            description: [
              `Problem: ${updated.problemStatement}`,
              `Zielgruppe: ${updated.targetAudience}`,
              `Outcome: ${updated.desiredOutcome}`,
            ].join('\n'),
            briefId: updated.id,
            projectId: project.id,
          })
        } catch { /* non-critical */ }
      })()

      // Auto-create GitHub repo when brief is accepted and GitHub is connected
      if (!updated.githubRepoUrl) {
        import('@/lib/connectors/config').then(async ({ readConnectorConfigs }) => {
          const { github: ghConfig } = readConnectorConfigs()
          if (!ghConfig?.token?.trim()) return
          const { createGitHubRepo } = await import('@/lib/connectors/github')
          const { updateProjectBrief, saveProjectBrief, readProjectBriefs } = await import('@/lib/project-briefs')
          const repoName = updated.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 80) || 'project'
          const created = await createGitHubRepo(ghConfig!, {
            name: repoName,
            description: updated.problemStatement?.slice(0, 200) ?? '',
            isPrivate: true,
          })
          const latest = readProjectBriefs().find(b => b.id === updated.id)
          if (latest) {
            const patched = updateProjectBrief(latest.id, {
              githubRepoUrl: created.html_url,
              githubRepoName: created.full_name,
            })
            if (patched) saveProjectBrief(patched)
          }
        }).catch(() => { /* non-critical — GitHub repo creation is best-effort */ })
      }
    }

    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Failed to update project brief' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params
  try {
    const repo = createProjectBriefRepository()
    const deleted = await repo.delete(id)
    if (!deleted) {
      return NextResponse.json({ error: 'Project brief not found' }, { status: 404 })
    }
    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: 'Failed to delete project brief' }, { status: 500 })
  }
}
