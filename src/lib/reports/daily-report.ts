import type { AttentionItem } from '@/lib/models/attention'
import type { Delegation, DelegationStatus } from '@/lib/models/delegation'
import type { ProjectBrief } from '@/lib/models/project-brief'
import type { MemoryCard } from '@/lib/knowledge/types'
import type { DelegationStorageMode } from '@/lib/repositories/delegationRepository'
import { getCriticProviderPlan } from '@/lib/eval/grok-critic'
import { buildFailedDelegationTriage, type FailedDelegationTriageSummary } from '@/lib/delegations/triage'
import { buildFailedDelegationActionPlan, type FailedDelegationActionPlan } from '@/lib/delegations/triage-actions'
import { buildDelegationQueuePlan, type DelegationQueuePlan } from '@/lib/delegations/queue'
import { getAuthReadiness, type AuthReadiness } from '@/lib/auth/readiness'

export type DailyReportVerdict = 'green' | 'yellow' | 'red'
export type DailyReportRiskSeverity = 'critical' | 'high' | 'medium' | 'low'
export type DailyReportLLMTarget = 'assistant-auto' | 'critic-llm' | 'planning-llm' | 'coding-agent' | 'ux-agent'
export type DailyReportLoopStepStatus = 'done' | 'active' | 'blocked' | 'pending'

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
  owner: 'codex' | 'claude' | 'critic-llm' | 'assistant-auto' | 'human'
  priority: 'P0' | 'P1' | 'P2'
  acceptanceCriteria: string[]
}

export interface DailyReportPrompt {
  target: DailyReportLLMTarget
  title: string
  preferredRoute: 'auto' | 'local-first' | 'best-available' | 'cloud-complex'
  prompt: string
}

export interface DailyReportAssistantRouting {
  mode: 'auto'
  recommended: {
    target: DailyReportLLMTarget
    providerId?: string
    model?: string
    reason: string
  }
  policy: {
    localFirst: string[]
    cloudEscalation: string[]
    configurableVia: string[]
  }
  criticPlan: ReturnType<typeof getCriticProviderPlan>
}

export interface DailyReportAssistantChecklistItem {
  id: 'auth' | 'storage' | 'critic-router' | 'execute-evidence' | 'failed-delegations' | 'delegation-queue' | 'attention-items'
  label: string
  status: 'ready' | 'warning' | 'blocker'
  detail: string
  action: string
  href: string
}

export interface DailyReportAssistantReadiness {
  status: 'ready' | 'attention' | 'blocked'
  score: number
  nextFocus: string
  checklist: DailyReportAssistantChecklistItem[]
}

export interface DailyReportLoopStep {
  id: 'brief' | 'delegation' | 'execute' | 'pr' | 'critic' | 'writeback'
  label: string
  status: DailyReportLoopStepStatus
  action: string
  href: string
}

export interface DailyReportFirstRealValueLoop {
  goal: string
  progressPct: number
  currentStep: DailyReportLoopStep
  steps: DailyReportLoopStep[]
}

export interface DailyReportExecuteLoopEvidenceRun {
  id: string
  title: string
  status: 'success' | 'partial' | 'blocked'
  source: 'manual' | 'runtime-aggregate' | 'harness-dry-run'
  recordedAt: string
  delegationId?: string
  briefId?: string
  prUrl?: string
  timeSavedMinutes?: number
  manualInterventions?: number
  blocker?: string
  notes?: string
  steps: {
    brief: boolean
    delegation: boolean
    execute: boolean
    tests: boolean
    pr: boolean
    critic: boolean
    writeback: boolean
  }
}

export interface DailyReportExecuteLoopEvidence {
  targetRuns: number
  totalRuns: number
  provenRuns: number
  blockedRuns: number
  progressPct: number
  currentStatus: 'not-started' | 'collecting' | 'proven' | 'blocked'
  nextAction: string
  runs: DailyReportExecuteLoopEvidenceRun[]
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
      authReadiness: AuthReadiness
    }
  }
  risks: DailyReportRisk[]
  nextActions: DailyReportTask[]
  firstRealValueLoop: DailyReportFirstRealValueLoop
  executeLoopEvidence: DailyReportExecuteLoopEvidence
  assistantRouting: DailyReportAssistantRouting
  dailyAssistant: DailyReportAssistantReadiness
  failedDelegationTriage: FailedDelegationTriageSummary
  failedDelegationActionPlan: FailedDelegationActionPlan
  delegationQueuePlan: DelegationQueuePlan
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
  authReadiness?: AuthReadiness
  executeLoopEvidence?: DailyReportExecuteLoopEvidenceRun[]
}

const NEXT_REAL_TICKET_PROMPT = [
  'Starte ein kleines reales ForgePilot-Entwicklungsticket, das den Alltag spuerbar verbessert.',
  'Halte den Scope eng, erstelle einen klaren Brief, eine Delegation, einen PR, einen Critic Review und einen Knowledge Writeback.',
  'Vergleiche am Ende die gesparte Zeit und dokumentiere, was zuverlaessig funktioniert hat.',
].join(' ')

function ideaHrefWithPrompt(prompt: string): string {
  return `/idea?prompt=${encodeURIComponent(prompt)}`
}

function countDelegations(delegations: Delegation[]): DailyReport['status']['delegations'] {
  const counts = {
    pending: 0,
    approved: 0,
    running: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    rejected: 0,
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

function isKnowledgeWriteback(card: MemoryCard, delegationIds: Set<string>): boolean {
  return card.tags.includes('auto-extracted')
    || card.tags.some(tag => tag.startsWith('delegation:'))
    || card.sourceIds.some(id => delegationIds.has(id))
    || card.sourceIds.some(id => id.startsWith('extraction:'))
}

function buildRisks(input: {
  authDisabled: boolean
  authReadiness: AuthReadiness
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
  } else if (input.authReadiness.status === 'blocked') {
    risks.push({
      id: 'auth-not-production-ready',
      severity: 'high',
      title: 'Auth is not production-ready',
      why: input.authReadiness.nextAction,
      mitigation: 'Set a strong FORGEPILOT_ADMIN_PASSWORD, NEXTAUTH_SECRET and NEXTAUTH_URL, then verify /api/auth/readiness before daily use.',
    })
  } else if (input.authReadiness.status === 'warning') {
    risks.push({
      id: 'auth-readiness-warning',
      severity: 'medium',
      title: 'Auth has a setup warning',
      why: input.authReadiness.nextAction,
      mitigation: 'Resolve the warning before exposing ForgePilot beyond localhost.',
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
      mitigation: 'Run npm run critic:backfill and ensure the Critic LLM router has at least one working provider, local or cloud.',
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

function buildFirstRealValueLoop(status: DailyReport['status']): DailyReportFirstRealValueLoop {
  const hasBrief = status.projectBriefs.total > 0
  const hasAcceptedBrief = status.projectBriefs.accepted > 0
  const hasDelegation = status.delegations.total > 0
  const hasExecutionStarted = status.delegations.running > 0
    || status.delegations.completed > 0
    || status.delegations.failed > 0
  const hasCompletedExecution = status.delegations.completed > 0
  const hasFailedExecution = status.delegations.failed > 0
  const hasPr = status.quality.prsCreated > 0
  const hasCritic = status.quality.completedDelegations > 0
    && status.quality.criticCoveragePct >= 80
  const hasWriteback = status.quality.knowledgeWritebacks > 0

  const steps: DailyReportLoopStep[] = [
    {
      id: 'brief',
      label: 'Idea -> Brief',
      status: hasAcceptedBrief ? 'done' : hasBrief ? 'active' : 'active',
      action: hasBrief ? 'Review and accept one project brief.' : 'Create the first focused project brief.',
      href: hasBrief ? '/project-briefs' : '/idea',
    },
    {
      id: 'delegation',
      label: 'Brief -> Delegation',
      status: hasDelegation ? 'done' : hasAcceptedBrief ? 'active' : 'pending',
      action: 'Create one narrow delegation with scope, risk and acceptance criteria.',
      href: hasAcceptedBrief ? '/delegations?new=1' : '/project-briefs',
    },
    {
      id: 'execute',
      label: 'Execute',
      status: hasCompletedExecution ? 'done' : hasFailedExecution ? 'blocked' : hasExecutionStarted ? 'active' : hasDelegation ? 'active' : 'pending',
      action: hasFailedExecution
        ? 'Open the failed delegation, read the human-readable error and choose retry or escalation.'
        : 'Start one approved delegation and verify that it produces a real result.',
      href: hasFailedExecution ? '/delegations?filter=failed' : '/delegations',
    },
    {
      id: 'pr',
      label: 'Pull Request',
      status: hasPr ? 'done' : hasCompletedExecution ? 'active' : 'pending',
      action: 'Create or verify the GitHub PR with a clear summary and test plan.',
      href: '/delegations',
    },
    {
      id: 'critic',
      label: 'Critic Review',
      status: hasCritic ? 'done' : hasCompletedExecution ? 'active' : 'pending',
      action: 'Run the best-available critic model and store score, verdict and repair notes.',
      href: '/api/reports/daily?format=markdown',
    },
    {
      id: 'writeback',
      label: 'Knowledge Writeback',
      status: hasWriteback ? 'done' : hasCritic ? 'active' : 'pending',
      action: 'Save useful learnings and decisions into project knowledge.',
      href: '/knowledge-cards',
    },
  ]

  const doneCount = steps.filter(step => step.status === 'done').length
  const allDone = doneCount === steps.length
  const currentStep = allDone
    ? {
        ...steps[steps.length - 1],
        label: 'Loop complete',
        action: 'Run the next small real ticket through the full loop and compare time saved.',
        href: ideaHrefWithPrompt(NEXT_REAL_TICKET_PROMPT),
      }
    : steps.find(step => step.status === 'blocked')
    ?? steps.find(step => step.status === 'active')
    ?? steps.find(step => step.status === 'pending')
    ?? steps[steps.length - 1]

  return {
    goal: 'Prove one real small ticket from idea to reviewed PR and knowledge writeback.',
    progressPct: pct(doneCount, steps.length),
    currentStep,
    steps,
  }
}

function isEvidenceRunProven(run: DailyReportExecuteLoopEvidenceRun): boolean {
  return run.source !== 'harness-dry-run'
    && run.status === 'success'
    && run.steps.brief
    && run.steps.delegation
    && run.steps.execute
    && run.steps.tests
    && run.steps.pr
    && run.steps.critic
    && run.steps.writeback
}

function evidenceDisplayRank(run: DailyReportExecuteLoopEvidenceRun): number {
  if (isEvidenceRunProven(run)) return 0
  if (run.source !== 'harness-dry-run' && run.status === 'blocked') return 1
  if (run.source !== 'harness-dry-run') return 2
  return 3
}

function inferRuntimeEvidenceRun(
  status: DailyReport['status'],
  generatedAt: string,
): DailyReportExecuteLoopEvidenceRun | null {
  const steps = {
    brief: status.projectBriefs.accepted > 0,
    delegation: status.delegations.total > 0,
    execute: status.quality.completedDelegations > 0,
    tests: status.quality.completedDelegations > 0,
    pr: status.quality.prsCreated > 0,
    critic: status.quality.criticScoresStored > 0,
    writeback: status.quality.knowledgeWritebacks > 0,
  }
  const completedSteps = Object.values(steps).filter(Boolean).length

  if (completedSteps === 0) return null

  return {
    id: 'runtime-aggregate-current',
    title: 'Current runtime aggregate evidence',
    status: completedSteps === Object.keys(steps).length ? 'success' : 'partial',
    source: 'runtime-aggregate',
    recordedAt: generatedAt,
    notes: 'Derived from current ForgePilot runtime data. Replace with manual evidence runs after each real ticket.',
    steps,
  }
}

function buildExecuteLoopEvidence(
  status: DailyReport['status'],
  generatedAt: string,
  explicitRuns: DailyReportExecuteLoopEvidenceRun[] = [],
): DailyReportExecuteLoopEvidence {
  const targetRuns = 5
  const runtimeRun = explicitRuns.length > 0 ? null : inferRuntimeEvidenceRun(status, generatedAt)
  const runs = runtimeRun ? [runtimeRun] : explicitRuns
  const realRuns = runs.filter(run => run.source !== 'harness-dry-run')
  const provenRuns = runs.filter(isEvidenceRunProven).length
  const blockedRuns = realRuns.filter(run => run.status === 'blocked').length
  const displayRuns = [...runs].sort((a, b) => {
    const rankDelta = evidenceDisplayRank(a) - evidenceDisplayRank(b)
    if (rankDelta !== 0) return rankDelta
    return new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
  })
  const currentStatus: DailyReportExecuteLoopEvidence['currentStatus'] =
    provenRuns >= targetRuns ? 'proven'
    : blockedRuns > 0 && provenRuns === 0 ? 'blocked'
    : runs.length > 0 ? 'collecting'
    : 'not-started'
  const remainingRuns = Math.max(targetRuns - provenRuns, 0)

  return {
    targetRuns,
    totalRuns: runs.length,
    provenRuns,
    blockedRuns,
    progressPct: pct(provenRuns, targetRuns),
    currentStatus,
    nextAction: remainingRuns === 0
      ? 'Summarize V1 readiness and decide whether ForgePilot is ready for daily use.'
      : `Run and record ${remainingRuns} more real small ticket loop${remainingRuns === 1 ? '' : 's'} with PR, critic review and writeback evidence.`,
    runs: displayRuns.slice(0, targetRuns),
  }
}

function buildNextActions(risks: DailyReportRisk[], loop: DailyReportFirstRealValueLoop): DailyReportTask[] {
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
    id: 'first-real-value-loop',
    title: `M3 First Real Value Loop: ${loop.currentStep.action}`,
    owner: 'codex',
    priority: 'P0',
    acceptanceCriteria: [
      `Current step is visible in the Daily Report: ${loop.currentStep.label}.`,
      'One real small ticket flows from idea/brief to delegation, execution, tests, PR, critic review and writeback.',
      'Failures produce understandable recovery actions instead of raw logs only.',
    ],
  })

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
    id: 'daily-report-llm-review',
    title: 'Run best-available LLM review on this daily report',
    owner: 'critic-llm',
    priority: 'P1',
    acceptanceCriteria: [
      'The selected LLM returns Executive Verdict, Top 5 risks and 3 concrete Codex/Claude/local-agent tasks.',
      'The LLM does not request secrets or broad write access.',
      'Feedback is compared against MVP scope before implementation.',
    ],
  })

  return actions.slice(0, 5)
}

function buildAssistantRouting(): DailyReportAssistantRouting {
  const criticPlan = getCriticProviderPlan()
  const bestCandidate = criticPlan.candidates.find(candidate => candidate.configured !== false) ?? criticPlan.candidates[0]

  return {
    mode: 'auto',
    recommended: {
      target: 'assistant-auto',
      providerId: bestCandidate?.providerId,
      model: bestCandidate?.model,
      reason: bestCandidate?.configured === false
        ? 'No configured critic provider is available yet; configure a cloud key or start Ollama/LM Studio.'
        : 'Use the best configured critic/planning model first; fall back through the provider chain until a valid structured answer is produced.',
    },
    policy: {
      localFirst: [
        'Summaries, status classification, low-risk planning, context compression and quick sanity checks.',
        'Use Ollama or LM Studio when the task does not require external knowledge, advanced reasoning or high-stakes security review.',
      ],
      cloudEscalation: [
        'Security-sensitive reviews, architecture decisions, complex code changes, failed local validation or confidence below 75%.',
        'Use the strongest configured cloud model first, then fall back to cheaper/free providers if appropriate.',
      ],
      configurableVia: [
        'FORGEPILOT_CRITIC_MODE=auto',
        'FORGEPILOT_CRITIC_PROVIDERS=provider=model,provider:model,provider',
        'Settings -> AI Providers for provider keys, local endpoints and custom OpenAI-compatible providers.',
      ],
    },
    criticPlan,
  }
}

function buildDailyAssistantReadiness(input: {
  status: DailyReport['status']
  executeLoopEvidence: DailyReportExecuteLoopEvidence
  assistantRouting: DailyReportAssistantRouting
  failedDelegationTriage: FailedDelegationTriageSummary
}): DailyReportAssistantReadiness {
  const hasCriticProvider = input.assistantRouting.criticPlan.candidates.some(candidate => candidate.configured !== false)
  const checklist: DailyReportAssistantChecklistItem[] = [
    {
      id: 'auth',
      label: 'Auth aktiv',
      status: input.status.operations.authReadiness.status === 'ready'
        ? 'ready'
        : input.status.operations.authReadiness.status === 'warning'
          ? 'warning'
          : 'blocker',
      detail: input.status.operations.authDisabled
        ? 'Testmodus ist aktiv. Produktiv nur mit Login und starken Secrets nutzen.'
        : input.status.operations.authReadiness.readyForProduction
          ? 'Login-Guard und Auth-Secrets sind produktionsbereit.'
          : input.status.operations.authReadiness.nextAction,
      action: input.status.operations.authReadiness.readyForProduction ? 'Auth pruefen' : 'Auth konfigurieren',
      href: '/settings',
    },
    {
      id: 'storage',
      label: 'Persistenz stabil',
      status: input.status.operations.storageMode === 'json' ? 'warning' : 'ready',
      detail: input.status.operations.storageMode === 'json'
        ? 'JSON ist noch primaer. Fuer produktive Agentenarbeit Postgres bevorzugen.'
        : `Storage laeuft im Modus ${input.status.operations.storageMode}.`,
      action: 'Storage ansehen',
      href: '/api/storage-status',
    },
    {
      id: 'critic-router',
      label: 'Critic-Router bereit',
      status: hasCriticProvider ? 'ready' : 'blocker',
      detail: hasCriticProvider
        ? `${input.assistantRouting.recommended.providerId ?? 'Auto'} ist als beste verfuegbare Route vorgesehen.`
        : 'Kein lokaler oder Cloud-Critic ist verfuegbar.',
      action: 'Provider pruefen',
      href: '/settings',
    },
    {
      id: 'execute-evidence',
      label: 'Execute-Beweise',
      status: input.executeLoopEvidence.provenRuns >= input.executeLoopEvidence.targetRuns
        ? 'ready'
        : input.executeLoopEvidence.provenRuns > 0
          ? 'warning'
          : 'blocker',
      detail: `${input.executeLoopEvidence.provenRuns}/${input.executeLoopEvidence.targetRuns} echte Runs belegt.`,
      action: 'Evidence ansehen',
      href: '/api/reports/daily?format=markdown',
    },
    {
      id: 'failed-delegations',
      label: 'Fehler-Triage',
      status: input.status.delegations.failed > 0 ? 'blocker' : 'ready',
      detail: input.status.delegations.failed > 0
        ? `${input.status.delegations.failed} fehlerhafte Delegationen: ${input.failedDelegationTriage.missingFeedback} ohne Fehlertext, ${input.failedDelegationTriage.retryable} retrybar.`
        : 'Keine fehlerhaften Delegationen blockieren den Alltag.',
      action: input.status.delegations.failed > 0 ? 'Fehler pruefen' : 'Delegations ansehen',
      href: input.status.delegations.failed > 0 ? '/delegations?filter=failed' : '/delegations',
    },
    {
      id: 'delegation-queue',
      label: 'Queue steuerbar',
      status: input.status.delegations.running > 2
        ? 'blocker'
        : input.status.delegations.approved > 6 || input.status.delegations.pending > 10
          ? 'warning'
          : 'ready',
      detail: input.status.delegations.running > 2
        ? `${input.status.delegations.running} Delegationen laufen parallel. Erst abschliessen lassen.`
        : input.status.delegations.approved > 6
          ? `${input.status.delegations.approved} freigegebene Delegationen warten. Starte kleine Batches statt alles parallel.`
          : `${input.status.delegations.pending} pending, ${input.status.delegations.approved} approved, ${input.status.delegations.running} running.`,
      action: 'Queue planen',
      href: '/api/delegations/queue-plan',
    },
    {
      id: 'attention-items',
      label: 'Offene Entscheidungen',
      status: input.status.operations.openAttentionItems > 0 ? 'warning' : 'ready',
      detail: input.status.operations.openAttentionItems > 0
        ? `${input.status.operations.openAttentionItems} offene Attention Items sollten aufgeraeumt werden.`
        : 'Keine offenen Attention Items.',
      action: 'Attention ansehen',
      href: '/',
    },
  ]

  const itemScores: number[] = checklist.map(item => item.status === 'ready' ? 100 : item.status === 'warning' ? 60 : 0)
  const score = Math.round(itemScores.reduce((sum, value) => sum + value, 0) / checklist.length)
  const blockingItem = checklist.find(item => item.status === 'blocker')
  const warningItem = checklist.find(item => item.status === 'warning')

  return {
    status: blockingItem ? 'blocked' : warningItem ? 'attention' : 'ready',
    score,
    nextFocus: blockingItem?.action ?? warningItem?.action ?? 'Naechsten kleinen echten Loop starten',
    checklist,
  }
}

function buildPrompts(): DailyReportPrompt[] {
  return [
    {
      target: 'assistant-auto',
      title: 'Daily assistant review',
      preferredRoute: 'auto',
      prompt: 'Review this ForgePilot Daily Report as the best available assistant model. Prefer the configured Critic LLM router; local models are fine for summaries and failed-delegation triage, cloud models for complex/security decisions. Return Executive Verdict, Top 5 risks, next 3 tasks for Codex/Claude/local agents, and what not to build yet. Do not ask for secrets or broad write access.',
    },
    {
      target: 'planning-llm',
      title: 'Planning gateway action JSON',
      preferredRoute: 'best-available',
      prompt: 'Convert this Daily Report into ForgePilot Planning Gateway JSON. Include milestones, issues, risks and doNotBuild. Prioritize P0 First Real Value Loop and reliability, then P1 core UX. Do not request tokens or secrets. Keep each issue scoped with owner, writeScope, acceptanceCriteria and verification.',
    },
    {
      target: 'critic-llm',
      title: 'Coding validation pass',
      preferredRoute: 'cloud-complex',
      prompt: 'Act as a validation engineer. Use this Daily Report to produce a focused validation matrix and at most 3 small patch plans. Each patch plan must include owner, writeScope, acceptanceCriteria, verification commands and rollback note. Focus on Execute Loop, Auth/Postgres hardening and PR/critic/writeback reliability. Do not ask for secrets or broad write access.',
    },
    {
      target: 'coding-agent',
      title: 'Implementation pick',
      preferredRoute: 'best-available',
      prompt: 'Use the Daily Report to pick the highest-value P0/P1 task. If failed delegation triage shows missing feedback, fix error capture before retrying. Claim a narrow write scope, implement it, run type-check, focused tests, lint, full tests when risk warrants it, build, then open a PR with verification.',
    },
    {
      target: 'ux-agent',
      title: 'UX polish pass',
      preferredRoute: 'cloud-complex',
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
    `- Auth readiness: ${report.status.operations.authReadiness.status} (${report.status.operations.authReadiness.readyForProduction ? 'production-ready' : report.status.operations.authReadiness.nextAction})`,
    ``,
    `## First Real Value Loop`,
    `- Goal: ${report.firstRealValueLoop.goal}`,
    `- Progress: ${report.firstRealValueLoop.progressPct}%`,
    `- Current step: ${report.firstRealValueLoop.currentStep.label} — ${report.firstRealValueLoop.currentStep.action}`,
    ...report.firstRealValueLoop.steps.map(step => `- [${step.status.toUpperCase()}] ${step.label}: ${step.action}`),
    ``,
    `## Execute Loop Evidence`,
    `- Target: ${report.executeLoopEvidence.targetRuns} real runs`,
    `- Proven: ${report.executeLoopEvidence.provenRuns}/${report.executeLoopEvidence.targetRuns}`,
    `- Progress: ${report.executeLoopEvidence.progressPct}%`,
    `- Status: ${report.executeLoopEvidence.currentStatus}`,
    `- Next action: ${report.executeLoopEvidence.nextAction}`,
    ...report.executeLoopEvidence.runs.map(run => {
      const pr = run.prUrl ? `, PR: ${run.prUrl}` : ''
      const blocker = run.blocker ? `, blocker: ${run.blocker}` : ''
      const notes = run.notes ? ` — ${run.notes}` : ''
      return `- [${run.status.toUpperCase()}] ${run.title} (${run.source}${pr}${blocker})${notes}`
    }),
    ``,
    `## Assistant Routing`,
    `- Mode: ${report.assistantRouting.mode}`,
    `- Recommended: ${report.assistantRouting.recommended.providerId ?? 'configured provider'}${report.assistantRouting.recommended.model ? ` / ${report.assistantRouting.recommended.model}` : ''}`,
    `- Reason: ${report.assistantRouting.recommended.reason}`,
    `- Candidate chain: ${report.assistantRouting.criticPlan.candidates.slice(0, 8).map(candidate => {
      const model = candidate.model ? `/${candidate.model}` : ''
      const state = candidate.configured === false ? 'missing' : 'ready'
      return `${candidate.providerId}${model} (${state})`
    }).join(' -> ')}`,
    `- Config: ${report.assistantRouting.policy.configurableVia.join('; ')}`,
    ``,
    `## Daily Assistant Readiness`,
    `- Status: ${report.dailyAssistant.status}`,
    `- Score: ${report.dailyAssistant.score}/100`,
    `- Next focus: ${report.dailyAssistant.nextFocus}`,
    ...report.dailyAssistant.checklist.map(item => `- [${item.status.toUpperCase()}] ${item.label}: ${item.detail} Action: ${item.action}`),
    ``,
    `## Failed Delegation Triage`,
    `- Total failed: ${report.failedDelegationTriage.total}`,
    `- Missing feedback: ${report.failedDelegationTriage.missingFeedback}`,
    `- Retryable: ${report.failedDelegationTriage.retryable}`,
    `- Known cause: ${report.failedDelegationTriage.knownCause}`,
    `- Needs human review: ${report.failedDelegationTriage.needsHumanReview}`,
    `- Safe next action: ${report.failedDelegationActionPlan.nextAction}`,
    `- Safe retry batch: ${report.failedDelegationActionPlan.retryableIds.length > 0 ? report.failedDelegationActionPlan.retryableIds.join(', ') : 'none'}`,
    ...report.failedDelegationActionPlan.warnings.map(warning => `- Warning: ${warning}`),
    ...(
      report.failedDelegationTriage.topItems.length > 0
        ? report.failedDelegationTriage.topItems.map(item => `- [${item.severity.toUpperCase()}] ${item.title}: ${item.category}/${item.failureCause}. Action: ${item.recommendedAction} Evidence: ${item.evidence}`)
        : ['- No failed delegations to triage.']
    ),
    ``,
    `## Delegation Queue Plan`,
    `- Pending: ${report.delegationQueuePlan.stats.pending}`,
    `- Approved: ${report.delegationQueuePlan.stats.approved}`,
    `- Running: ${report.delegationQueuePlan.stats.running}`,
    `- Completed: ${report.delegationQueuePlan.stats.completed}`,
    `- Failed: ${report.delegationQueuePlan.stats.failed}`,
    `- Rejected: ${report.delegationQueuePlan.stats.rejected}`,
    `- Cancelled: ${report.delegationQueuePlan.stats.cancelled}`,
    `- Max concurrent: ${report.delegationQueuePlan.maxConcurrent}`,
    `- Safe next action: ${report.delegationQueuePlan.nextAction}`,
    `- Safe start batch: ${report.delegationQueuePlan.recommendedStartIds.length > 0 ? report.delegationQueuePlan.recommendedStartIds.join(', ') : 'none'}`,
    ...report.delegationQueuePlan.warnings.map(warning => `- Warning: ${warning}`),
    ...(
      report.delegationQueuePlan.recommendedBatch.length > 0
        ? report.delegationQueuePlan.recommendedBatch.map(item => `- [START] ${item.title}: ${item.actionHref}`)
        : ['- No approved delegation is ready to start.']
    ),
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
    lines.push(`### ${prompt.target}: ${prompt.title}`, `Preferred route: ${prompt.preferredRoute}`, prompt.prompt, ``)
  }

  lines.push(
    `## Planning Gateway`,
    `- Schema/prompt endpoint: /api/planning/grok (LLM-compatible; historical route name)`,
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
  const delegationIds = new Set(input.delegations.map(delegation => delegation.id))
  const criticScoresStored = completedDelegations.filter(d => Boolean(d.criticScore)).length
  const prsCreated = input.delegations.filter(d => Boolean(d.summaryReport?.prUrl)).length
  const staleRunningDelegations = input.delegations.filter(d => isStaleRunning(d, now)).length
  const knowledgeWritebacks = input.knowledgeCards.filter(card => isKnowledgeWriteback(card, delegationIds)).length
  const authReadiness = input.authReadiness ?? getAuthReadiness({
    FORGEPILOT_AUTH_DISABLED: input.authDisabled ? 'true' : undefined,
    FORGEPILOT_ADMIN_PASSWORD: 'redacted-strong-password',
    NEXTAUTH_SECRET: 'x'.repeat(40),
    NEXTAUTH_URL: 'http://localhost:3000',
  } as unknown as NodeJS.ProcessEnv)

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
      authReadiness,
    },
  }

  const risks = buildRisks({
    authDisabled: status.operations.authDisabled,
    authReadiness: status.operations.authReadiness,
    storageMode: status.operations.storageMode,
    failedDelegations: status.delegations.failed,
    openAttentionItems: status.operations.openAttentionItems,
    staleRunningDelegations: status.operations.staleRunningDelegations,
    criticCoveragePct: status.quality.criticCoveragePct,
    completedDelegations: status.quality.completedDelegations,
  })
  const executiveVerdict = buildVerdict(risks)
  const firstRealValueLoop = buildFirstRealValueLoop(status)
  const executeLoopEvidence = buildExecuteLoopEvidence(status, generatedAt, input.executeLoopEvidence)
  const nextActions = buildNextActions(risks, firstRealValueLoop)
  const assistantRouting = buildAssistantRouting()
  const failedDelegationTriage = buildFailedDelegationTriage(input.delegations)
  const failedDelegationActionPlan = buildFailedDelegationActionPlan(failedDelegationTriage)
  const delegationQueuePlan = buildDelegationQueuePlan({
    delegations: input.delegations,
    max: 2,
    maxConcurrent: 2,
  })
  const dailyAssistant = buildDailyAssistantReadiness({ status, executeLoopEvidence, assistantRouting, failedDelegationTriage })
  const prompts = buildPrompts()
  const withoutMarkdown = {
    version: 1 as const,
    generatedAt,
    period: 'daily' as const,
    executiveVerdict,
    status,
    risks,
    nextActions,
    firstRealValueLoop,
    executeLoopEvidence,
    assistantRouting,
    dailyAssistant,
    failedDelegationTriage,
    failedDelegationActionPlan,
    delegationQueuePlan,
    prompts,
  }

  return {
    ...withoutMarkdown,
    markdown: renderDailyReportMarkdown(withoutMarkdown),
  }
}
