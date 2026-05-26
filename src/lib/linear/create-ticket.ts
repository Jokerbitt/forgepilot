/**
 * create-ticket.ts — M217
 * Safe wrapper for creating Linear tickets from ForgePilot briefs.
 * Never throws.
 */
import { createLinearClient } from './client'
import { apiLogger } from '@/lib/logger'

export interface LinearTicketResult {
  created: boolean
  issueId?: string
  identifier?: string
  url?: string
  reason?: string
}

export async function createLinearTicketForBrief(params: {
  title: string
  description: string
  briefId: string
  /** Link this ticket to an existing Linear project */
  projectId?: string
}): Promise<LinearTicketResult> {
  const linear = createLinearClient()
  if (!linear) {
    return { created: false, reason: 'LINEAR_API_KEY not configured' }
  }
  try {
    const issue = await linear.createIssue({
      title: params.title,
      description: `**ForgePilot Brief:** ${params.briefId}\n\n${params.description}`,
      projectId: params.projectId,
    })
    if (!issue) return { created: false, reason: 'Linear API returned no issue' }
    apiLogger.info({ event: 'linear.ticket.created', issueId: issue.id, identifier: issue.identifier, briefId: params.briefId })
    return { created: true, issueId: issue.id, identifier: issue.identifier, url: issue.url }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    apiLogger.warn({ event: 'linear.ticket.create.failed', reason: msg, briefId: params.briefId })
    return { created: false, reason: msg }
  }
}
