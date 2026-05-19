export type ProjectBriefStatus = 'draft' | 'in_review' | 'accepted' | 'archived'
export type BriefScope = 'minimal' | 'standard' | 'full'
export type ResearchMode = 'quick' | 'standard' | 'deep'
export type ResearchPrivacyMode = 'local' | 'hybrid' | 'cloud'
export type ExecutorType = 'agent' | 'n8n' | 'local_script' | 'browser' | 'human'
export type ResearchBriefStatus = 'draft' | 'ready' | 'running' | 'completed' | 'cancelled'
export type ResearchRunStatus = 'queued' | 'running' | 'review_pending' | 'completed' | 'failed' | 'cancelled'
export type SourceType = 'web' | 'github' | 'arxiv' | 'docs' | 'pdf' | 'obsidian' | 'nas' | 'blog' | 'vendor_docs'
export type FindingConfidence = 'high' | 'medium' | 'low' | 'uncertain'
export type ImpactLevel = 'critical' | 'high' | 'medium' | 'low' | 'informational'
export type BlueprintOutputType =
  | 'findings_summary'
  | 'project_brief'
  | 'requirements'
  | 'use_cases'
  | 'market_analysis'
  | 'architecture'
  | 'roadmap'
  | 'linear_plan'
  | 'adr_candidate'

export type RequirementType = 'functional' | 'non_functional' | 'constraint' | 'assumption'
export type RequirementPriority = 'must' | 'should' | 'could' | 'wont'
export type RequirementSource = 'user_input' | 'ai_proposed' | 'research'

export interface Requirement {
  id: string
  briefId: string
  type: RequirementType
  title: string
  description: string
  priority: RequirementPriority
  source: RequirementSource
  findingIds: string[]
  status: 'proposed' | 'accepted' | 'rejected'
}

export interface UseCase {
  id: string
  briefId: string
  title: string
  actor: string
  trigger: string
  mainFlow: string[]
  alternativeFlows?: string[]
  preconditions?: string[]
  postconditions?: string[]
  requirementIds: string[]
  status: 'proposed' | 'accepted' | 'rejected'
}

export interface Risk {
  id: string
  briefId: string
  title: string
  description: string
  probability: 'low' | 'medium' | 'high'
  impact: 'low' | 'medium' | 'high'
  mitigationIdea?: string
  isOpenAssumption: boolean
  findingIds: string[]
}

export interface ResearchBriefDraft {
  title: string
  mode: ResearchMode
  privacyMode: ResearchPrivacyMode
  preferredExecutor: ExecutorType
  researchQuestions: string[]
  searchTerms: string[]
  preferredSourceTypes: SourceType[]
  excludeCriteria: string[]
}

export interface ResearchBriefOutputSchema {
  requiredOutputs: BlueprintOutputType[]
  optionalOutputs: BlueprintOutputType[]
  evidenceRules: string[]
  qualityGates: string[]
  writebackTargets: Array<'nas' | 'obsidian' | 'linear'>
}

export interface ResearchBrief {
  id: string
  briefId: string
  title: string
  status: ResearchBriefStatus
  createdAt: string
  researchQuestions: string[]
  searchTerms: string[]
  preferredSourceTypes: SourceType[]
  excludeCriteria: string[]
  mode: ResearchMode
  privacyMode: ResearchPrivacyMode
  maxBudgetUsd?: number
  maxDurationMinutes?: number
  preferredExecutor: ExecutorType
  outputSchema: ResearchBriefOutputSchema
}

export interface SourceRecord {
  id: string
  runId: string
  type: SourceType
  title: string
  urlOrPath: string
  publisher?: string
  author?: string
  publishedAt?: string
  retrievedAt: string
  language?: string
  relevanceScore: number
  trustScore: number
  notes?: string
  snippets: string[]
}

export interface Finding {
  id: string
  runId: string
  claim: string
  summary: string
  sourceIds: string[]
  confidence: FindingConfidence
  isContradicted: boolean
  contradictionIds: string[]
  isOpenAssumption: boolean
  recommendationImpact: ImpactLevel
  tags: string[]
}

export type BlueprintOutputStatus = 'draft' | 'review_pending' | 'accepted' | 'rejected'

export interface BlueprintOutput {
  id: string
  runId: string
  briefId: string
  type: BlueprintOutputType
  title: string
  content: string
  linkedFindingIds: string[]
  linkedRequirementIds: string[]
  status: BlueprintOutputStatus
  reviewedAt?: string
  reviewerNotes?: string
}

export interface ResearchRun {
  id: string
  researchBriefId: string
  briefId: string
  title: string
  status: ResearchRunStatus
  mode: ResearchMode
  privacyMode: ResearchPrivacyMode
  executor: ExecutorType
  startedAt: string
  completedAt?: string
  budgetUsd?: number
  actualCostUsd?: number
  sources: SourceRecord[]
  findings: Finding[]
  outputs: BlueprintOutput[]
  confidenceScore?: number
  openUncertainties: string[]
  errorMessage?: string
}

export interface ProjectBrief {
  id: string
  title: string
  status: ProjectBriefStatus
  createdAt: string
  updatedAt: string
  rawIdea: string
  problemStatement: string
  targetAudience: string
  desiredOutcome: string
  constraints: string[]
  scope: BriefScope
  researchMode: ResearchMode
  privacyMode: ResearchPrivacyMode
  requirements: Requirement[]
  useCases: UseCase[]
  nonGoals: string[]
  risks: Risk[]
  researchRunIds: string[]
  lastResearchRun?: ResearchRun
  delegationIds?: string[]
  researchBriefDraft: ResearchBriefDraft
  reviewedAt?: string
  reviewedBy?: string
  notes?: string
}

export interface IdeaIntakeInput {
  title: string
  rawIdea: string
  problemStatement: string
  targetAudience: string
  desiredOutcome: string
  constraints: string[]
  scope: BriefScope
  researchMode: ResearchMode
  privacyMode: ResearchPrivacyMode
}

export type IdeaIntakeField = keyof IdeaIntakeInput
export type IdeaIntakeValidationErrors = Partial<Record<IdeaIntakeField, string>>
