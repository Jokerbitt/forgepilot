import { z } from 'zod'
import { createGitHubIssue, type GitHubConnectorConfig } from '@/lib/connectors/github'
import { createLinearIssue, type LinearConnectorConfig } from '@/lib/connectors/linear'
import type { Fetcher } from '@/lib/connectors/shared'

const PRIORITIES = ['P0', 'P1', 'P2'] as const
const OWNERS = ['codex', 'claude', 'grok', 'human'] as const
const SYSTEMS = ['linear', 'github', 'both'] as const

export type PlanningPriority = typeof PRIORITIES[number]
export type PlanningOwner = typeof OWNERS[number]
export type PlanningSystem = typeof SYSTEMS[number]
export type PlanningMode = 'preview' | 'create-linear' | 'create-github' | 'create-all'

export const grokPlanningIssueSchema = z.object({
  title: z.string().trim().min(4).max(140),
  description: z.string().trim().min(10).max(4000),
  priority: z.enum(PRIORITIES),
  labels: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  owner: z.enum(OWNERS).default('codex'),
  writeScope: z.array(z.string().trim().min(1).max(160)).max(12).default([]),
  acceptanceCriteria: z.array(z.string().trim().min(3).max(300)).min(1).max(10),
  verification: z.array(z.string().trim().min(3).max(200)).max(8).default([]),
})

export const grokPlanningMilestoneSchema = z.object({
  title: z.string().trim().min(4).max(140),
  goal: z.string().trim().min(10).max(2000),
  priority: z.enum(PRIORITIES),
  system: z.enum(SYSTEMS).default('both'),
  acceptanceCriteria: z.array(z.string().trim().min(3).max(300)).min(1).max(10),
  issues: z.array(grokPlanningIssueSchema).min(1).max(12),
})

export const grokPlanningActionPlanSchema = z.object({
  milestones: z.array(grokPlanningMilestoneSchema).min(1).max(8),
  doNotBuild: z.array(z.string().trim().min(3).max(240)).max(12).default([]),
  risks: z.array(z.object({
    title: z.string().trim().min(3).max(180),
    severity: z.enum(['critical', 'high', 'medium', 'low']),
    mitigation: z.string().trim().min(5).max(500),
  })).max(10).default([]),
})

export type GrokPlanningIssue = z.infer<typeof grokPlanningIssueSchema>
export type GrokPlanningMilestone = z.infer<typeof grokPlanningMilestoneSchema>
export type GrokPlanningActionPlan = z.infer<typeof grokPlanningActionPlanSchema>

export interface PlanningItem {
  id: string
  milestoneTitle: string
  targetSystem: PlanningSystem
  title: string
  description: string
  priority: PlanningPriority
  labels: string[]
  owner: PlanningOwner
  writeScope: string[]
  acceptanceCriteria: string[]
  verification: string[]
  linearPriority: number
  githubLabels: string[]
  body: string
}

export interface PlanningApplyResult {
  mode: PlanningMode
  created: Array<{
    target: 'linear' | 'github'
    title: string
    identifier?: string
    url: string
  }>
  skipped: Array<{
    target: 'linear' | 'github'
    title: string
    reason: string
  }>
}

export function parseGrokPlanningActionPlan(input: unknown): GrokPlanningActionPlan {
  return grokPlanningActionPlanSchema.parse(input)
}

export function buildPlanningItems(plan: GrokPlanningActionPlan): PlanningItem[] {
  const items: PlanningItem[] = []

  plan.milestones.forEach((milestone, milestoneIndex) => {
    milestone.issues.forEach((issue, issueIndex) => {
      const id = `grok-plan-${milestoneIndex + 1}-${issueIndex + 1}`
      const labels = unique([
        'forgepilot',
        'grok-planning',
        'mvp',
        priorityLabel(issue.priority),
        ...issue.labels.map(normalizeLabel),
      ]).filter(Boolean)

      items.push({
        id,
        milestoneTitle: milestone.title,
        targetSystem: milestone.system,
        title: `[${issue.priority}] ${issue.title}`,
        description: issue.description,
        priority: issue.priority,
        labels,
        owner: issue.owner,
        writeScope: issue.writeScope,
        acceptanceCriteria: issue.acceptanceCriteria,
        verification: issue.verification,
        linearPriority: toLinearPriority(issue.priority),
        githubLabels: labels,
        body: renderPlanningItemBody(milestone, issue),
      })
    })
  })

  return items
}

export async function applyPlanningItems(
  items: PlanningItem[],
  options: {
    mode: PlanningMode
    linearConfig?: LinearConnectorConfig
    githubConfig?: GitHubConnectorConfig
    fetcher?: Fetcher
  },
): Promise<PlanningApplyResult> {
  const result: PlanningApplyResult = {
    mode: options.mode,
    created: [],
    skipped: [],
  }

  if (options.mode === 'preview') return result

  const shouldCreateLinear = options.mode === 'create-linear' || options.mode === 'create-all'
  const shouldCreateGitHub = options.mode === 'create-github' || options.mode === 'create-all'
  const fetcher = options.fetcher ?? fetch

  for (const item of items) {
    if (shouldCreateLinear && (item.targetSystem === 'linear' || item.targetSystem === 'both')) {
      const apiKey = options.linearConfig?.apiKey
      const teamId = options.linearConfig?.teamId
      if (!apiKey || !teamId) {
        result.skipped.push({ target: 'linear', title: item.title, reason: 'Linear config missing' })
      } else {
        const issue = await createLinearIssue({ ...options.linearConfig, apiKey, teamId }, {
          teamId,
          title: item.title,
          description: item.body,
          priority: item.linearPriority,
        }, fetcher)
        result.created.push({
          target: 'linear',
          title: item.title,
          identifier: issue.identifier,
          url: issue.url,
        })
      }
    }

    if (shouldCreateGitHub && (item.targetSystem === 'github' || item.targetSystem === 'both')) {
      const token = options.githubConfig?.token
      const owner = options.githubConfig?.owner
      const repo = options.githubConfig?.repositories?.[0]
      if (!token || !owner || !repo) {
        result.skipped.push({ target: 'github', title: item.title, reason: 'GitHub config missing' })
      } else {
        const issue = await createGitHubIssue({ ...options.githubConfig, token, owner }, {
          owner,
          repo,
          title: item.title,
          body: item.body,
          labels: item.githubLabels,
        }, fetcher)
        result.created.push({
          target: 'github',
          title: item.title,
          identifier: `#${issue.number}`,
          url: issue.html_url,
        })
      }
    }
  }

  return result
}

export function renderPlanningPrompt(): string {
  return [
    'Du bist ForgePilot Planning Critic. Erzeuge ausschliesslich valides JSON.',
    'Plane die naechsten Meilensteine fuer ForgePilot V1, ohne Secrets anzufordern.',
    'Prioritaet: Auth/Security, PostgreSQL Cutover, Kernflow, Premium UI, Onboarding.',
    'Nicht im MVP: PM-Agent, Agent Control Plane, Billing, Multi-Tenancy.',
    'Schema:',
    JSON.stringify({
      milestones: [{
        title: 'string',
        goal: 'string',
        priority: 'P0|P1|P2',
        system: 'linear|github|both',
        acceptanceCriteria: ['string'],
        issues: [{
          title: 'string',
          description: 'string',
          priority: 'P0|P1|P2',
          labels: ['mvp'],
          owner: 'codex|claude|grok|human',
          writeScope: ['src/...'],
          acceptanceCriteria: ['string'],
          verification: ['npm run type-check'],
        }],
      }],
      doNotBuild: ['string'],
      risks: [{ title: 'string', severity: 'critical|high|medium|low', mitigation: 'string' }],
    }, null, 2),
  ].join('\n')
}

function renderPlanningItemBody(milestone: GrokPlanningMilestone, issue: GrokPlanningIssue): string {
  return [
    `## Milestone`,
    milestone.title,
    '',
    `## Goal`,
    milestone.goal,
    '',
    `## Task`,
    issue.description,
    '',
    `## Owner`,
    issue.owner,
    '',
    `## Write Scope`,
    ...(issue.writeScope.length > 0 ? issue.writeScope.map(scope => `- ${scope}`) : ['- Not specified by Grok; narrow before implementation.']),
    '',
    `## Acceptance Criteria`,
    ...issue.acceptanceCriteria.map(criterion => `- ${criterion}`),
    '',
    `## Verification`,
    ...(issue.verification.length > 0 ? issue.verification.map(step => `- ${step}`) : ['- Add focused tests or manual verification before closing.']),
    '',
    `---`,
    `Created from Grok Planning Gateway. Review scope and risk before implementation.`,
  ].join('\n')
}

function toLinearPriority(priority: PlanningPriority): number {
  if (priority === 'P0') return 1
  if (priority === 'P1') return 2
  return 3
}

function priorityLabel(priority: PlanningPriority): string {
  return priority.toLowerCase()
}

function normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9:_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values))
}
