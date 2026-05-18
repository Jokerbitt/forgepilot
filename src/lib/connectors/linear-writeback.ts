import type { Delegation } from '@/lib/models/delegation'
import { readStoredApiKeys } from './config'

interface LinearWritebackResult {
  success: boolean
  commentId?: string
  error?: string
}

/**
 * Post a completion comment to the Linear issue referenced by the delegation's workItemId.
 * Only called when the delegation completes successfully and has a workItemId that looks like
 * a Linear identifier (e.g. "JOK-42", "ENG-7").
 */
export async function postLinearCompletionComment(
  delegation: Delegation,
  fetcher: typeof fetch = fetch,
): Promise<LinearWritebackResult> {
  const stored = readStoredApiKeys()
  const apiKey = (process.env.LINEAR_API_KEY || stored.LINEAR_API_KEY)?.trim()
  if (!apiKey) return { success: false, error: 'LINEAR_API_KEY not configured' }

  const workItemId = delegation.contract.workItemId
  // Linear identifiers look like "TEAM-123"
  if (!workItemId || !/^[A-Z]+-\d+$/i.test(workItemId)) {
    return { success: false, error: `workItemId "${workItemId}" is not a Linear identifier` }
  }

  const report = delegation.summaryReport
  const prUrl = report?.prUrl

  const body = [
    `✅ **ForgePilot Agent abgeschlossen**`,
    '',
    prUrl ? `**Pull Request:** ${prUrl}` : '',
    report?.timeTakenMinutes ? `**Dauer:** ${report.timeTakenMinutes} min` : '',
    delegation.actualCostUsd != null ? `**Kosten:** $${delegation.actualCostUsd.toFixed(4)}` : '',
    '',
    report?.keyPoints?.length
      ? `**Ergebnisse:**\n${report.keyPoints.map(p => `- ${p}`).join('\n')}`
      : '',
  ].filter(Boolean).join('\n').trim()

  // First resolve the issue ID from identifier
  const resolveQuery = `
    query IssueByIdentifier($identifier: String!) {
      issue(id: $identifier) { id identifier title }
    }
  `

  try {
    const resolveRes = await fetcher('https://api.linear.app/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: apiKey },
      body: JSON.stringify({ query: resolveQuery, variables: { identifier: workItemId } }),
    })
    const resolveData = await resolveRes.json() as {
      data?: { issue?: { id: string; identifier: string } }
      errors?: Array<{ message: string }>
    }

    if (resolveData.errors?.length || !resolveData.data?.issue?.id) {
      return { success: false, error: resolveData.errors?.[0]?.message ?? 'Issue not found' }
    }

    const issueId = resolveData.data.issue.id

    const commentMutation = `
      mutation CreateComment($issueId: String!, $body: String!) {
        commentCreate(input: { issueId: $issueId, body: $body }) {
          success
          comment { id }
        }
      }
    `

    const commentRes = await fetcher('https://api.linear.app/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: apiKey },
      body: JSON.stringify({ query: commentMutation, variables: { issueId, body } }),
    })
    const commentData = await commentRes.json() as {
      data?: { commentCreate?: { success: boolean; comment?: { id: string } } }
      errors?: Array<{ message: string }>
    }

    if (commentData.errors?.length) {
      return { success: false, error: commentData.errors[0].message }
    }

    return {
      success: commentData.data?.commentCreate?.success ?? false,
      commentId: commentData.data?.commentCreate?.comment?.id,
    }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}
