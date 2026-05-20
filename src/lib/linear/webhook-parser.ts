/**
 * Linear Webhook Parser — M126
 *
 * Parses incoming Linear webhook payloads and converts "In Progress"
 * issue events into ForgePilot TaskContract candidates.
 */

import crypto from 'crypto'

export interface LinearIssueState {
  id: string
  name: string
  type: 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'cancelled'
}

export interface LinearLabel { id: string; name: string }

export interface LinearIssue {
  id: string
  identifier: string
  title: string
  description?: string
  priority: number
  state: LinearIssueState
  labels?: LinearLabel[]
  url: string
}

export interface LinearWebhookPayload {
  action: 'create' | 'update' | 'remove'
  type: 'Issue' | 'Comment' | 'Project' | 'Cycle' | 'IssueLabel' | string
  data: LinearIssue
  updatedFrom?: Partial<LinearIssue> & { state?: LinearIssueState }
  organizationId: string
  webhookTimestamp: number
}

export interface LinearDelegationCandidate {
  workItemId: string
  title: string
  goal: string
  context: string
  riskClass: 'A' | 'B' | 'C'
  branchStrategy: 'feature' | 'fix' | 'chore'
  requiresApproval: boolean
  maxBudgetUsd: number
  priority: number
  linearUrl: string
  labels: string[]
}

export type WebhookParseResult =
  | { action: 'create-delegation'; candidate: LinearDelegationCandidate }
  | { action: 'ignore'; reason: string }

const IN_PROGRESS_STATE_TYPES: LinearIssueState['type'][] = ['started']

function priorityToRiskClass(priority: number): 'A' | 'B' | 'C' {
  if (priority === 1) return 'C'
  if (priority === 2) return 'B'
  return 'A'
}

function titleToBranchStrategy(title: string): 'feature' | 'fix' | 'chore' {
  const lower = title.toLowerCase()
  if (/\b(fix|bug|error|crash|broken|regression)\b/.test(lower)) return 'fix'
  if (/\b(chore|deps|dependency|refactor|cleanup|test|ci|docs)\b/.test(lower)) return 'chore'
  return 'feature'
}

function priorityToBudget(priority: number): number {
  if (priority === 1) return 5
  if (priority === 2) return 3
  if (priority === 3) return 2
  return 1
}

export function parseLinearWebhook(payload: LinearWebhookPayload): WebhookParseResult {
  if (payload.type !== 'Issue') {
    return { action: 'ignore', reason: `Webhook type "${payload.type}" not handled` }
  }
  if (payload.action !== 'update') {
    return { action: 'ignore', reason: `Action "${payload.action}" ignored (only "update" triggers delegation)` }
  }

  const issue = payload.data
  const previousState = payload.updatedFrom?.state

  if (!IN_PROGRESS_STATE_TYPES.includes(issue.state.type)) {
    return { action: 'ignore', reason: `State "${issue.state.name}" (${issue.state.type}) is not "started"` }
  }

  if (previousState && IN_PROGRESS_STATE_TYPES.includes(previousState.type)) {
    return { action: 'ignore', reason: 'Issue was already in progress — no state transition detected' }
  }

  const labels = (issue.labels ?? []).map(l => l.name)
  const riskClass = priorityToRiskClass(issue.priority)
  const branchStrategy = titleToBranchStrategy(issue.title)
  const requiresApproval = riskClass === 'C'

  const descriptionSnippet = issue.description
    ? `\n\nContext from Linear:\n${issue.description.slice(0, 500)}${issue.description.length > 500 ? '…' : ''}`
    : ''

  const candidate: LinearDelegationCandidate = {
    workItemId:      issue.identifier,
    title:           issue.title,
    goal:            `Implement: ${issue.title}${descriptionSnippet}`,
    context:         `Linear issue ${issue.identifier}: ${issue.url}`,
    riskClass,
    branchStrategy,
    requiresApproval,
    maxBudgetUsd:    priorityToBudget(issue.priority),
    priority:        issue.priority,
    linearUrl:       issue.url,
    labels,
  }

  return { action: 'create-delegation', candidate }
}

export function verifyLinearSignature(
  rawBody: string,
  signature: string | null,
  secret: string | undefined,
): boolean {
  if (!secret) return true
  if (!signature) return false
  const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}
