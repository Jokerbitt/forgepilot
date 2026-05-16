export type ProjectBriefStatus = 'draft' | 'in_review' | 'accepted' | 'archived'
export type BriefScope = 'minimal' | 'standard' | 'full'
export type ResearchMode = 'quick' | 'standard' | 'deep'
export type ResearchPrivacyMode = 'local' | 'hybrid' | 'cloud'
export type ExecutorType = 'agent' | 'n8n' | 'local_script' | 'browser' | 'human'

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
  preferredSourceTypes: Array<'web' | 'github' | 'docs' | 'pdf' | 'obsidian' | 'nas' | 'blog' | 'vendor_docs'>
  excludeCriteria: string[]
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
