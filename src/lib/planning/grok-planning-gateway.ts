import { z } from 'zod'
import { createHash } from 'crypto'
import { createGitHubIssue, type GitHubConnectorConfig } from '@/lib/connectors/github'
import { createLinearIssue, type LinearConnectorConfig } from '@/lib/connectors/linear'
import type { Fetcher } from '@/lib/connectors/shared'

const PRIORITIES = ['P0', 'P1', 'P2'] as const
const OWNERS = ['codex', 'claude', 'grok', 'human'] as const
const SYSTEMS = ['linear', 'github', 'both'] as const
const ALLOWED_LABELS = [
  'auth',
  'db',
  'docs',
  'feature',
  'forgepilot',
  'grok-planning',
  'improvement',
  'migration',
  'mvp',
  'onboarding',
  'p0',
  'p1',
  'p2',
  'quality',
  'security',
  'tech-debt',
  'ui',
] as const

const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'GitHub token', pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b/ },
  { name: 'GitHub fine-grained token', pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/ },
  { name: 'Linear API token', pattern: /\blin_api_[A-Za-z0-9]{20,}\b/ },
  { name: 'OpenAI-compatible API key', pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { name: 'xAI API key', pattern: /\bxai-[A-Za-z0-9_-]{20,}\b/ },
  {
    name: 'Secret assignment',
    pattern: /\b(?:NEXTAUTH_SECRET|FORGEPILOT_ADMIN_PASSWORD|OPENAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN|LINEAR_API_KEY)\s*[:=]\s*\S{8,}/i,
  },
]

export type PlanningPriority = typeof PRIORITIES[number]
export type PlanningOwner = typeof OWNERS[number]
export type PlanningSystem = typeof SYSTEMS[number]
export type PlanningMode = 'preview' | 'create-linear' | 'create-github' | 'create-all'
export type PlanningLabel = typeof ALLOWED_LABELS[number]

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

export interface PlanningPayloadSafetyIssue {
  path: string
  message: string
}

export class PlanningPayloadSafetyError extends Error {
  issues: PlanningPayloadSafetyIssue[]

  constructor(issues: PlanningPayloadSafetyIssue[]) {
    super('Unsafe Grok planning payload')
    this.name = 'PlanningPayloadSafetyError'
    this.issues = issues
  }
}

export interface PlanningRequestSummary {
  payloadHash: string
  milestones: number
  items: number
  targetCounts: Record<'linear' | 'github', number>
  priorityCounts: Record<PlanningPriority, number>
  ownerCounts: Record<PlanningOwner, number>
}

export interface PlanningAudit {
  action: 'grok-planning'
  mode: PlanningMode
  payloadHash: string
  itemCount: number
  createdCount: number
  skippedCount: number
  createdAt: string
}

export function parseGrokPlanningActionPlan(input: unknown): GrokPlanningActionPlan {
  assertPayloadHasNoSecrets(input)
  const plan = grokPlanningActionPlanSchema.parse(input)
  assertLabelsAreAllowed(plan)
  return plan
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

export function summarizePlanningRequest(plan: GrokPlanningActionPlan, items: PlanningItem[]): PlanningRequestSummary {
  return {
    payloadHash: computePlanningPayloadHash(plan),
    milestones: plan.milestones.length,
    items: items.length,
    targetCounts: {
      linear: items.filter(item => item.targetSystem === 'linear' || item.targetSystem === 'both').length,
      github: items.filter(item => item.targetSystem === 'github' || item.targetSystem === 'both').length,
    },
    priorityCounts: {
      P0: items.filter(item => item.priority === 'P0').length,
      P1: items.filter(item => item.priority === 'P1').length,
      P2: items.filter(item => item.priority === 'P2').length,
    },
    ownerCounts: {
      codex: items.filter(item => item.owner === 'codex').length,
      claude: items.filter(item => item.owner === 'claude').length,
      grok: items.filter(item => item.owner === 'grok').length,
      human: items.filter(item => item.owner === 'human').length,
    },
  }
}

export function buildPlanningAudit(
  mode: PlanningMode,
  plan: GrokPlanningActionPlan,
  items: PlanningItem[],
  applyResult: PlanningApplyResult,
  now = new Date(),
): PlanningAudit {
  return {
    action: 'grok-planning',
    mode,
    payloadHash: computePlanningPayloadHash(plan),
    itemCount: items.length,
    createdCount: applyResult.created.length,
    skippedCount: applyResult.skipped.length,
    createdAt: now.toISOString(),
  }
}

export function computePlanningPayloadHash(payload: unknown): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex')
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

function assertLabelsAreAllowed(plan: GrokPlanningActionPlan): void {
  const allowed = new Set<string>(ALLOWED_LABELS)
  const issues: PlanningPayloadSafetyIssue[] = []

  plan.milestones.forEach((milestone, milestoneIndex) => {
    milestone.issues.forEach((issue, issueIndex) => {
      issue.labels.forEach((label, labelIndex) => {
        const normalized = normalizeLabel(label)
        if (!allowed.has(normalized)) {
          issues.push({
            path: `milestones.${milestoneIndex}.issues.${issueIndex}.labels.${labelIndex}`,
            message: `Label "${label}" is not allowed. Use one of: ${ALLOWED_LABELS.join(', ')}`,
          })
        }
      })
    })
  })

  if (issues.length > 0) {
    throw new PlanningPayloadSafetyError(issues)
  }
}

function assertPayloadHasNoSecrets(input: unknown): void {
  const issues: PlanningPayloadSafetyIssue[] = []
  scanForSecrets(input, '$', issues)

  if (issues.length > 0) {
    throw new PlanningPayloadSafetyError(issues)
  }
}

function scanForSecrets(value: unknown, path: string, issues: PlanningPayloadSafetyIssue[]): void {
  if (typeof value === 'string') {
    for (const { name, pattern } of SECRET_PATTERNS) {
      if (pattern.test(value)) {
        issues.push({
          path,
          message: `${name} detected. Remove credentials from the payload and provide them via ForgePilot connector configuration.`,
        })
      }
    }
    return
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForSecrets(entry, `${path}.${index}`, issues))
    return
  }

  if (typeof value === 'object' && value !== null) {
    Object.entries(value).forEach(([key, entry]) => scanForSecrets(entry, `${path}.${key}`, issues))
  }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }

  if (typeof value === 'object' && value !== null) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(',')}}`
  }

  return JSON.stringify(value)
}
