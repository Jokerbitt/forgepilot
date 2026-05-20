export const dynamic = 'force-dynamic'
/**
 * GET /api/projects
 *
 * Returns all projects — Project Briefs enriched with idea-history metadata
 * (run status, task count, work item count) where available.
 *
 * Projects without an idea-history entry are still returned (manually created briefs).
 */

import { NextResponse } from 'next/server'
import { readProjectBriefs } from '@/lib/project-briefs'
import { readIdeaHistory } from '@/lib/pilot/idea-history-store'
import { getRun } from '@/lib/agents/orchestrated-run'
import type { ProjectBrief } from '@/lib/models/project-brief'
import type { IdeaHistoryEntry } from '@/lib/pilot/idea-history-store'

export interface ProjectSummary {
  id: string
  title: string
  problemStatement: string
  createdAt: string
  /** Set when created via Idea → Production pipeline */
  pipeline?: {
    idea: string
    runId: string
    runStatus: 'building' | 'running' | 'done' | 'failed'
    workItemCount: number
    taskCount: number
    doneTasks: number
  }
}

export async function GET() {
  const briefs = readProjectBriefs()
  const history = readIdeaHistory(50)

  // Index history by briefId for O(1) lookup
  const historyByBriefId = new Map<string, IdeaHistoryEntry>()
  for (const entry of history) {
    historyByBriefId.set(entry.briefId, entry)
  }

  const projects: ProjectSummary[] = briefs.map((brief: ProjectBrief) => {
    const entry = historyByBriefId.get(brief.id)

    if (!entry) {
      return {
        id: brief.id,
        title: brief.title,
        problemStatement: brief.problemStatement ?? '',
        createdAt: brief.createdAt ?? new Date().toISOString(),
      }
    }

    // Enrich with live run data
    const run = getRun(entry.runId)
    const liveStatus: IdeaHistoryEntry['status'] = run
      ? run.status === 'done'    ? 'done'
      : run.status === 'failed' || run.status === 'aborted' ? 'failed'
      : run.status === 'running' ? 'running'
      : 'building'
      : entry.status

    const doneTasks = run ? run.tasks.filter(t => t.status === 'done').length : 0

    return {
      id: brief.id,
      title: brief.title,
      problemStatement: brief.problemStatement ?? '',
      createdAt: brief.createdAt ?? entry.createdAt,
      pipeline: {
        idea: entry.idea,
        runId: entry.runId,
        runStatus: liveStatus,
        workItemCount: entry.workItemCount,
        taskCount: entry.taskCount,
        doneTasks,
      },
    }
  })

  // Sort: pipeline projects first (by createdAt desc), then manual briefs
  projects.sort((a, b) => {
    const aHasPipeline = a.pipeline ? 1 : 0
    const bHasPipeline = b.pipeline ? 1 : 0
    if (aHasPipeline !== bHasPipeline) return bHasPipeline - aHasPipeline
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  return NextResponse.json(projects)
}
