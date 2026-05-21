import type { AttentionItem } from '@/lib/models/attention'
import type { Delegation, DelegationStatus } from '@/lib/models/delegation'
import type { ProjectBrief } from '@/lib/models/project-brief'
import type { MemoryCard } from '@/lib/knowledge/types'
import type { DelegationStorageMode } from '@/lib/repositories/delegationRepository'

export type DailyReportVerdict = 'green' | 'yellow' | 'red'
export type DailyReportRiskSeverity = 'critical' | 'high' | 'medium' | 'low'

export interface DailyReportRisk {
  id: string
  severity: DailyReportRiskSeverity
  title: string
  why: string
  mitigation: string
}

export interface DailyReportTask {
  id: string
  title: string
  owner: 'codex' | 'claude' | 'grok' | 'human'
  priority: 'P0' | 'P1' | 'P2'
  acceptanceCriteria: string[]
}

export interface DailyReportPrompt {
  target: 'grok' | 'codex' | 'claude'
  title: string
  prompt: string
}

export interface DailyReport {
  version: 1
  generatedAt: string
  period: 'daily'
  executiveVerdict: {
    status: DailyReportVerdict
    summary: string
  }
  status: {
    delegations: Record<DelegationStatus, number> & { total: number }
    projectBriefs: {
      total: number
      accepted: number
      inReview: number
      draft: number
    }
    quality: {
      completedDelegations: number
      criticScoresStored: number
      criticCoveragePct: number
      prsCreated: number
      knowledgeCards: number
      knowledgeWritebacks: number
    }
    operations: {
      openAttentionItems: number
      staleRunningDelegations: number
      storageMode: DelegationStorageMode
      authDisabled: boolean
    }
  }
  risks: DailyReportRisk[]
  nextActions: DailyReportTask[]
  prompts: DailyReportPrompt[]
  markdown: string
}

export interface BuildDailyReportInput {
  now?: Date
  delegations: Delegation[]
  projectBriefs: ProjectBrief[]
  knowledgeCards: MemoryCard[]
  attentionItems: AttentionItem[]
  storageMode: DelegationStorageMode
  authDisabled: boolean
}

function countDelegations(delegations: Delegation[]): DailyReport['status']['delegations'] {
  const counts = {
    pending: 0,
    approved: 0,
    running: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    total: delegations.length,
  }

  for (const delegation of delegations) {
    counts[delegation.status] += 1
  }

  return counts
}

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  return Math.round((numerator / denominator) * 100)
}

function isStaleRunning(delegation: Delegation, now: Date): boolean {
  if (delegation.status !== 'running') return false
  const updated = new Date(delegation.updatedAt || delegation.createdAt).getTime()
  if (!Number.isFinite(updated)) return false
  return now.getTime() - updated > 60 * 60 * 1000
}

function isKnowledgeWriteback(card: MemoryCard): boolean {
  return card.tags.includes('auto-extracted')
    || card.tags.some(tag => tag.startsWith('delegation:'))
    || card.sourceIds.some(id => id.startsWith('extraction:'))
}

function buildRisks(input: {
  authDisabled: boolean
  storageMode: DelegationStorageMode
  failedDelegations: number
  openAttentionItems: number
  staleRunningDelegations: number
  criticCoveragePct: number
  completedDelegations: number
}): DailyReportRisk[] {
  const risks: DailyReportRisk[] = []

  if (input.authDisabled) {
    risks.push({
      id: 'auth-disabled',
      severity: 'critical',
      title: 'Auth is disabled',
      why: 'Prompts, outputs, logs and connector settings may be exposed if the app is reachable beyond localhost.',
      mitigation: 'Set a strong FORGEPILOT_ADMIN_PASSWORD, NEXTAUTH_SECRET and NEXTAUTH_URL; use auth bypass only for local automated tests.',
    })
  }

  if (input.storageMode === 'json') {
    risks.push({
      id: 'json-primary-storage',
      severity: 'high',
      title: 'JSON is still primary storage',
      why: 'JSON files are useful for bootstrap, but they remain vulnerable to race conditions and weak queryability.',
      mitigation: 'Run Postgres in dual mode, backfill existing JSON data, then switch reads to postgres after verification.',
    })
  }

  if (input.failedDelegations > 0) {
    risks.push({
      id: 'failed-delegations',
      severity: 'high',
      title: 'Failed delegations need triage',
      why: 'Failures in the core flow reduce trust in autonomous execution and should feed retry prompts or manual repair tasks.',
      mitigation: 'Review failed delegation logs, classify failure causes, and create focused repair delegations with narrow write scopes.',
    })
  }

  if (input.staleRunningDelegations > 0) {
    risks.push({
      id: 'stale-running-delegations',
      severity: 'high',
      title: 'Running delegations look stale',
      why: 'A delegation with no recent activity may be stuck while still looking active to the user.',
      mitigation: 'Add or use health checks to mark stale runs, expose resume/cancel actions, and capture the last heartbeat.',
    })
  }

  if (input.completedDelegations > 0 && input.criticCoveragePct < 80) {
    risks.push({
      id: 'low-critic-coverage',
      severity: 'medium',
      title: 'Critic coverage is below target',
      why: 'The V1 promise depends on reviewed output, not blind agent completion.',
      mitigation: 'Ensure XAI_API_KEY/provider config is present or mark critic-unavailable clearly in execution summaries.',
    })
  }

  if (input.openAttentionItems > 0) {
    risks.push({
      id: 'open-attention-items',
      severity: 'medium',
      title: 'Open attention items need decision',
      why: 'Unresolved approvals, warnings or failures create hidden work and can derail the next-best-action flow.',
      mitigation: 'Resolve stale items, promote real blockers into Linear, and keep the Command Center focused on one next action.',
    })
  }

  return risks
}

function buildVerdict(risks: DailyReportRisk[]): DailyReport['executiveVerdict'] {
  if (risks.some(risk => risk.severity === 'critical')) {
    return {
      status: 'red',
      summary: 'Core progress is real, but at least one critical guardrail needs attention before broader use.',
    }
  }
  if (risks.some(risk => risk.severity === 'high')) {
    return {
      status: 'yellow',
      summary: 'ForgePilot is moving in the right direction, but V1 still needs focused stabilization before it feels production-ready.',
    }
  }
  return {
    status: 'green',
    summary: 'The V1 path is aligned: keep shipping the core flow and avoid new scope until it is reliably useful.',
  }
}

function buildNextActions(risks: DailyReportRisk[]): DailyReportTask[] {
  const byId = new Set(risks.map(risk => risk.id))
  const actions: DailyReportTask[] = []

  if (byId.has('auth-disabled')) {
    actions.push({
      id: 'secure-local-auth',
      title: 'Verify mandatory local auth configuration',
      owner: 'codex',
      priority: 'P0',
      acceptanceCriteria: [
        'Auth bypass remains limited to explicit test/dev mode.',
        'Readme/setup docs explain NEXTAUTH_SECRET, NEXTAUTH_URL and admin password.',
        'Security-sensitive API routes are covered by tests or shared guards.',
      ],
    })
  }

  if (byId.has('json-primary-storage')) {
    actions.push({
      id: 'postgres-cutover-checklist',
      title: 'Finish Postgres cutover checklist',
      owner: 'codex',
      priority: 'P0',
      acceptanceCriteria: [
        'Dual-write backfill path is documented and tested.',
        'Report exposes current storage mode.',
        'Switch-to-postgres criteria are explicit and reversible.',
      ],
    })
  }

  actions.push({
    id: 'premium-core-ui-pass',
    title: 'Polish Command Center and Delegation Detail for V1',
    owner: 'claude',
    priority: 'P1',
    acceptanceCriteria: [
      'Command Center answers one question: what is the next useful step?',
      'Delegation Detail highlights status, scope, critic verdict and PR result above logs.',
      'Information density is reduced and technical terms are explained or hidden.',
    ],
  })

  actions.push({
    id: 'grok-daily-critique',
    title: 'Run Grok critique on this daily report',
    owner: 'grok',
    priority: 'P1',
    acceptanceCriteria: [
      'Grok returns Executive Verdict, Top 5 risks and 3 concrete Codex/Claude tasks.',
      'Grok does not request secrets or write access.',
      'Feedback is compared against MVP scope before implementation.',
    ],
  })

  return actions.slice(0, 5)
}

function buildPrompts(): DailyReportPrompt[] {
  return [
    {
      target: 'grok',
      title: 'Daily critic review',
      prompt: 'Review this ForgePilot Daily Report as an external critic. Focus on MVP alignment, security, persistence risk, UI professionalism and scope drift. Return Executive Verdict, Top 5 risks, next 3 tasks for Codex/Claude, and what not to build yet. Do not ask for secrets or write access.',
    },
    {
      target: 'grok',
      title: 'Planning gateway action JSON',
      prompt: 'Convert this Daily Report into ForgePilot Planning Gateway JSON. Include milestones, issues, risks and doNotBuild. Prioritize P0 Auth/Security and PostgreSQL Cutover, then P1 core UX. Do not request tokens or secrets. Keep each issue scoped with owner, writeScope, acceptanceCriteria and verification.',
    },
    {
      target: 'grok',
      title: 'Coding validation pass',
      prompt: 'Act as Grok 4 Heavy in validation-engineer mode. Use this Daily Report to produce a focused validation matrix and at most 3 small patch plans. Each patch plan must include owner, writeScope, acceptanceCriteria, verification commands and rollback note. Focus on Execute Loop, Auth/Postgres hardening and PR/critic/writeback reliability. Do not ask for secrets or broad write access.',
    },
    {
      target: 'codex',
      title: 'Implementation pick',
      prompt: 'Use the Daily Report to pick the highest-value P0/P1 task. Claim a narrow write scope, implement it, run type-check, focused tests, lint, full tests when risk warrants it, build, then open a PR with verification.',
    },
    {
      target: 'claude',
      title: 'UX polish pass',
      prompt: 'Use the Daily Report to improve only the V1 core UI surfaces. Keep Command Center and Delegation Detail premium, sparse and task-focused. Do not add new product areas.',
    },
  ]
}

export function renderDailyReportMarkdown(report: Omit<DailyReport, 'markdown'>): string {
  const lines: string[] = [
    `# ForgePilot Daily Report`,
    ``,
    `Generated: ${report.generatedAt}`,
    ``,
    `## Executive Verdict`,
    `${report.executiveVerdict.status.toUpperCase()}: ${report.executiveVerdict.summary}`,
    ``,
    `## Status`,
    `- Delegations: ${report.status.delegations.total} total, ${report.status.delegations.completed} completed, ${report.status.delegations.failed} failed, ${report.status.delegations.running} running`,
    `- Project briefs: ${report.status.projectBriefs.total} total, ${report.status.projectBriefs.accepted} accepted, ${report.status.projectBriefs.inReview} in review`,
    `- Critic coverage: ${report.status.quality.criticCoveragePct}% (${report.status.quality.criticScoresStored}/${report.status.quality.completedDelegations} completed delegations)`,
    `- PRs created from delegations: ${report.status.quality.prsCreated}`,
    `- Knowledge cards: ${report.status.quality.knowledgeCards} total, ${report.status.quality.knowledgeWritebacks} writebacks`,
    `- Open attention items: ${report.status.operations.openAttentionItems}`,
    `- Storage mode: ${report.status.operations.storageMode}`,
    `- Auth disabled: ${report.status.operations.authDisabled ? 'yes' : 'no'}`,
    ``,
    `## Top Risks`,
  ]

  if (report.risks.length === 0) {
    lines.push(`- No blocking risks detected by the report builder.`)
  } else {
    for (const risk of report.risks.slice(0, 5)) {
      lines.push(`- [${risk.severity.toUpperCase()}] ${risk.title}: ${risk.why} Mitigation: ${risk.mitigation}`)
    }
  }

  lines.push(``, `## Next Actions`)
  for (const action of report.nextActions) {
    lines.push(`- ${action.priority} ${action.owner}: ${action.title}`)
  }

  lines.push(``, `## Prompts`)
  for (const prompt of report.prompts) {
    lines.push(`### ${prompt.target}: ${prompt.title}`, prompt.prompt, ``)
  }

  lines.push(
    `## Grok Planning Gateway`,
    `- Schema/prompt endpoint: /api/planning/grok`,
    `- Preview endpoint: POST /api/planning/grok?mode=preview`,
    `- Create Linear issues: POST /api/planning/grok?mode=create-linear with header x-forgepilot-confirm: create-planning-items`,
    `- Create GitHub issues: POST /api/planning/grok?mode=create-github with header x-forgepilot-confirm: create-planning-items`,
    `- Create both: POST /api/planning/grok?mode=create-all with header x-forgepilot-confirm: create-planning-items`,
    ``,
  )

  return lines.join('\n')
}

export function buildDailyReport(input: BuildDailyReportInput): DailyReport {
  const now = input.now ?? new Date()
  const generatedAt = now.toISOString()
  const delegationCounts = countDelegations(input.delegations)
  const completedDelegations = input.delegations.filter(d => d.status === 'completed')
  const criticScoresStored = completedDelegations.filter(d => Boolean(d.criticScore)).length
  const prsCreated = input.delegations.filter(d => Boolean(d.summaryReport?.prUrl)).length
  const staleRunningDelegations = input.delegations.filter(d => isStaleRunning(d, now)).length
  const knowledgeWritebacks = input.knowledgeCards.filter(isKnowledgeWriteback).length

  const status: DailyReport['status'] = {
    delegations: delegationCounts,
    projectBriefs: {
      total: input.projectBriefs.length,
      accepted: input.projectBriefs.filter(b => b.status === 'accepted').length,
      inReview: input.projectBriefs.filter(b => b.status === 'in_review').length,
      draft: input.projectBriefs.filter(b => b.status === 'draft').length,
    },
    quality: {
      completedDelegations: completedDelegations.length,
      criticScoresStored,
      criticCoveragePct: pct(criticScoresStored, completedDelegations.length),
      prsCreated,
      knowledgeCards: input.knowledgeCards.length,
      knowledgeWritebacks,
    },
    operations: {
      openAttentionItems: input.attentionItems.filter(item => !item.resolvedAt).length,
      staleRunningDelegations,
      storageMode: input.storageMode,
      authDisabled: input.authDisabled,
    },
  }

  const risks = buildRisks({
    authDisabled: status.operations.authDisabled,
    storageMode: status.operations.storageMode,
    failedDelegations: status.delegations.failed,
    openAttentionItems: status.operations.openAttentionItems,
    staleRunningDelegations: status.operations.staleRunningDelegations,
    criticCoveragePct: status.quality.criticCoveragePct,
    completedDelegations: status.quality.completedDelegations,
  })
  const executiveVerdict = buildVerdict(risks)
  const nextActions = buildNextActions(risks)
  const prompts = buildPrompts()
  const withoutMarkdown = {
    version: 1 as const,
    generatedAt,
    period: 'daily' as const,
    executiveVerdict,
    status,
    risks,
    nextActions,
    prompts,
  }

  return {
    ...withoutMarkdown,
    markdown: renderDailyReportMarkdown(withoutMarkdown),
  }
}
