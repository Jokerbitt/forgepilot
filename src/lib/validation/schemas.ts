/**
 * Zod Schemas — M94
 *
 * Central schema definitions for all API request bodies.
 * Schemas serve double duty: runtime validation + TypeScript types (z.infer<>).
 *
 * Usage:
 *   import { DelegationContractSchema } from '@/lib/validation/schemas'
 *   const data = DelegationContractSchema.parse(body)
 */

import { z } from 'zod'

// ─── Primitives ───────────────────────────────────────────────────────────────

export const RiskClassSchema = z.enum(['A', 'B', 'C'])
export const PrivacyModeSchema = z.enum(['local', 'private-cloud', 'public'])
export const LegalBasisSchema = z.enum(['legitimate-interest', 'contract', 'legal-obligation', 'consent'])
export const DataResidencySchema = z.enum(['eu', 'us', 'local', 'unknown'])
export const ProviderTypeSchema = z.enum(['anthropic', 'openai-compatible', 'ollama', 'custom'])

// ─── Delegation ───────────────────────────────────────────────────────────────

export const DelegationContractSchema = z.object({
  goal:             z.string().min(10, 'Goal must be at least 10 characters'),
  riskClass:        RiskClassSchema.default('A'),
  privacyMode:      PrivacyModeSchema.default('local'),
  requiresApproval: z.boolean().default(false),
  maxBudgetUsd:     z.number().min(0).max(1000).optional(),
  filePatterns:     z.array(z.string()).optional(),
  skillCategory:    z.string().optional(),
  acceptanceCriteria: z.array(z.string()).optional(),
  context:          z.string().optional(),
})

export type DelegationContract = z.infer<typeof DelegationContractSchema>

export const CreateDelegationSchema = z.object({
  title:            z.string().min(3, 'Title required').max(200),
  contract:         DelegationContractSchema,
  dataSubjectId:    z.string().optional(),
  privacyClass:     z.string().optional(),
  autoOrchestrate:  z.boolean().optional(),
})

export type CreateDelegationInput = z.infer<typeof CreateDelegationSchema>

// ─── Idea Intake ──────────────────────────────────────────────────────────────

export const IdeaIntakeSchema = z.object({
  idea:             z.string().min(10, 'Idea must be at least 10 characters').max(2000),
  context:          z.string().max(5000).optional(),
  targetUsers:      z.string().max(500).optional(),
  successMetric:    z.string().max(500).optional(),
  riskTolerance:    RiskClassSchema.optional(),
  autoRun:          z.boolean().optional(),
})

export type IdeaIntakeInput = z.infer<typeof IdeaIntakeSchema>

// ─── Work Item ────────────────────────────────────────────────────────────────

export const WorkItemSchema = z.object({
  id:               z.string().optional(),
  title:            z.string().min(3).max(500),
  url:              z.string().url().optional().or(z.literal('')),
  projectId:        z.string().optional(),
  status:           z.enum(['todo', 'in_progress', 'done', 'blocked']).default('todo'),
  priority:         z.number().int().min(0).max(10).default(1),
  riskClass:        RiskClassSchema.default('A'),
  aiDelegable:      z.boolean().default(false),
  estimatedMinutes: z.number().int().min(0).optional(),
  metadata:         z.record(z.string(), z.unknown()).optional(),
})

export type WorkItemInput = z.infer<typeof WorkItemSchema>

// ─── AI Provider ─────────────────────────────────────────────────────────────

export const ProviderConfigSchema = z.object({
  id:           z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'ID must be lowercase alphanumeric with hyphens'),
  name:         z.string().min(1).max(100),
  type:         ProviderTypeSchema,
  apiKey:       z.string().optional(),
  baseUrl:      z.string().url().optional(),
  enabled:      z.boolean().default(true),
  models:       z.array(z.object({
    id:           z.string(),
    name:         z.string(),
    purpose:      z.enum(['fast', 'coding', 'embedding', 'both']),
    costPer1kIn:  z.number().min(0),
    costPer1kOut: z.number().min(0),
  })).optional(),
})

export type ProviderConfigInput = z.infer<typeof ProviderConfigSchema>

export const ModelSelectionSchema = z.object({
  fastProvider:      z.string(),
  fastModel:         z.string(),
  codingProvider:    z.string(),
  codingModel:       z.string(),
  embeddingProvider: z.string().optional(),
})

export type ModelSelectionInput = z.infer<typeof ModelSelectionSchema>

// ─── Eval ─────────────────────────────────────────────────────────────────────

export const EvalCaseSchema = z.object({
  id:                 z.string().optional(),
  title:              z.string().min(3).max(200),
  prompt:             z.string().min(10),
  skillCategory:      z.string().optional(),
  acceptanceCriteria: z.array(z.string()).min(1, 'At least one criterion required'),
  goldenOutput:       z.string().optional(),
  tags:               z.array(z.string()).default([]),
  active:             z.boolean().default(true),
})

export type EvalCaseInput = z.infer<typeof EvalCaseSchema>

export const ScoreRequestSchema = z.object({
  caseId:                    z.string().min(1),
  agentOutput:               z.string().min(1),
  tokensUsed:                z.number().int().min(0).optional(),
  costUsd:                   z.number().min(0).optional(),
  filesChangedOutsideScope:  z.number().int().min(0).optional(),
  totalFilesChanged:         z.number().int().min(0).optional(),
  delegationId:              z.string().optional(),
  runId:                     z.string().optional(),
  promptVariant:             z.string().optional(),
  providerId:                z.string().optional(),
  modelId:                   z.string().optional(),
})

export type ScoreRequestInput = z.infer<typeof ScoreRequestSchema>

// ─── DSGVO / Erasure ─────────────────────────────────────────────────────────

export const ErasureRequestSchema = z.object({
  externalId: z.string().min(1, 'externalId required').max(255),
  execute:    z.boolean().optional(),
})

export type ErasureRequestInput = z.infer<typeof ErasureRequestSchema>

export const LogProcessingInputSchema = z.object({
  purpose:       z.string().min(1),
  dataTypes:     z.array(z.string()).min(1),
  providerId:    z.string().min(1),
  modelId:       z.string().optional(),
  legalBasis:    LegalBasisSchema.optional(),
  dataSubjectId: z.string().optional(),
  piiRedacted:   z.boolean().optional(),
  dataResidency: DataResidencySchema.optional(),
  inputTokens:   z.number().int().min(0).optional(),
})

export type LogProcessingInput = z.infer<typeof LogProcessingInputSchema>

// ─── Agent Run ───────────────────────────────────────────────────────────────

export const CreateAgentRunSchema = z.object({
  delegationId: z.string().min(1, 'delegationId required'),
  contractId:   z.string().min(1, 'contractId required'),
  model:        z.string().min(1, 'model required'),
})

export type CreateAgentRunInput = z.infer<typeof CreateAgentRunSchema>

// ─── Settings / NBA Config ────────────────────────────────────────────────────

export const NBAConfigUpdateSchema = z.object({
  ignoreStatuses:        z.array(z.string()).optional(),
  penalizeOldBacklogs:   z.boolean().optional(),
  backlogPenaltyAgeDays: z.number().int().min(0).optional(),
  backlogPenaltyScore:   z.number().min(0).optional(),
  showTriageJoker:       z.boolean().optional(),
  maxRecommendations:    z.number().int().min(1).max(20).optional(),
  pinnedItems:           z.array(z.string()).optional(),
  customLlmModels:       z.array(z.string()).optional(),
  projects:              z.array(z.string()).optional(),
  milestones:            z.array(z.string()).optional(),
  approvalMode:          z.enum(['manual', 'balanced', 'autopilot']).optional(),
  autopilotMinScore:     z.number().min(0).max(100).optional(),
  autopilotMaxRiskClass: z.enum(['A', 'B', 'C']).optional(),
  aiProvider:            z.enum(['anthropic', 'ollama']).optional(),
  localCodingModel:      z.string().optional(),
  localFastModel:        z.string().optional(),
  maxConcurrentAgents:   z.number().int().min(1).max(10).optional(),
  autoStartApproved:     z.boolean().optional(),
  autoPmAgent:           z.boolean().optional(),
}).strict()

export type NBAConfigUpdate = z.infer<typeof NBAConfigUpdateSchema>

// ─── Attention Item ───────────────────────────────────────────────────────────

export const AttentionItemCreateSchema = z.object({
  id:                z.string().optional(),
  type:              z.enum(['delegation_completed', 'delegation_failed', 'delegation_stalled', 'budget_exceeded', 'approval_pending', 'escalation', 'system_error', 'review_passed', 'review_failed']),
  severity:          z.enum(['info', 'warning', 'critical']).default('info'),
  title:             z.string().min(3, 'Title required').max(200),
  body:              z.string().max(2000).optional(),
  delegationId:      z.string().optional(),
  actionUrl:         z.string().url().optional(),
  escalationContext: z.object({
    problem:        z.string(),
    options:        z.array(z.string()).optional(),
    recommendation: z.string().optional(),
  }).optional(),
})

export type AttentionItemCreate = z.infer<typeof AttentionItemCreateSchema>

// ─── Work Item Import ─────────────────────────────────────────────────────────

export const WorkItemImportSchema = z.object({
  csv: z.string().min(1, 'CSV content required'),
})

export type WorkItemImportInput = z.infer<typeof WorkItemImportSchema>

// ─── Delegation Version ────────────────────────────────────────────────────────

export const TaskContractSchema = z.object({
  id:                    z.string(),
  workItemId:            z.string(),
  goal:                  z.string(),
  context:               z.string(),
  taskType:              z.enum(['feature', 'bugfix', 'docs', 'refactor', 'research']).optional(),
  definitionOfDone:      z.array(z.string()),
  riskClass:             RiskClassSchema,
  maxBudgetUsd:          z.number(),
  allowedTools:          z.array(z.string()),
  branchStrategy:        z.enum(['feature', 'fix', 'chore']),
  requiresApproval:      z.boolean(),
  privacyMode:           PrivacyModeSchema,
  llmModel:              z.string().optional(),
  outputMode:            z.enum(['text', 'json', 'stream']).optional(),
  skillCategory:         z.enum(['api-route', 'ui-component', 'data-model', 'test', 'refactor', 'infrastructure', 'documentation']).optional(),
  allowedFilePatterns:   z.array(z.string()).optional(),
  orchestratedRunId:     z.string().optional(),
  createdAt:             z.string(),
})

export type TaskContractInput = z.infer<typeof TaskContractSchema>

export const DelegationVersionSchema = z.object({
  delegationId: z.string().min(1, 'delegationId required'),
  delegation:   z.record(z.string(), z.any()).optional(),
  contract:     TaskContractSchema,
  reason:       z.string().optional(),
})

export type DelegationVersionInput = z.infer<typeof DelegationVersionSchema>

// ─── Delegation Patch ────────────────────────────────────────────────────────

export const PatchDelegationSchema = z.object({
  status:     z.enum(['pending', 'approved', 'running', 'completed', 'failed', 'cancelled']).optional(),
  agentRunId: z.string().optional(),
  note:       z.object({ text: z.string().max(2000), updatedAt: z.string() }).optional().nullable(),
})

export type PatchDelegationInput = z.infer<typeof PatchDelegationSchema>

// ─── Delegation Escalate ─────────────────────────────────────────────────────

export const EscalateSchema = z.object({
  problem:        z.string().min(1, 'problem required'),
  options:        z.array(z.string()).optional(),
  recommendation: z.string().optional(),
})

export type EscalateInput = z.infer<typeof EscalateSchema>

// ─── Import Logs ─────────────────────────────────────────────────────────────

export const ImportLogsSchema = z.object({
  output: z.string().min(1, 'output required'),
  status: z.enum(['pending', 'approved', 'running', 'completed', 'failed', 'cancelled']).optional(),
})

export type ImportLogsInput = z.infer<typeof ImportLogsSchema>

// ─── Delegation Preflight ────────────────────────────────────────────────────

export const DelegationPreflightSchema = z.object({
  delegationId: z.string().min(1, 'delegationId required'),
})

export type DelegationPreflightInput = z.infer<typeof DelegationPreflightSchema>

// ─── Knowledge Card ──────────────────────────────────────────────────────────

export const KnowledgeCardSchema = z.object({
  id:           z.string().optional(),
  type:         z.enum(['decision', 'pattern', 'learning', 'risk', 'requirement', 'context']),
  title:        z.string().min(1, 'title required').max(200),
  body:         z.string().min(1, 'body required'),
  sourceIds:    z.array(z.string()).optional(),
  projectId:    z.string().optional(),
  tags:         z.array(z.string()).optional(),
  privacyClass: z.enum(['public', 'internal', 'sensitive', 'local-only']).optional(),
  confidence:   z.enum(['high', 'medium', 'low']).optional(),
  createdAt:    z.string().optional(),
})

export type KnowledgeCardInput = z.infer<typeof KnowledgeCardSchema>

// ─── Knowledge Source ────────────────────────────────────────────────────────

export const KnowledgeSourceSchema = z.object({
  id:                z.string().optional(),
  type:              z.enum(['nas', 'markdown', 'linear', 'github', 'agent-run', 'obsidian', 'manual']),
  name:              z.string().min(1, 'name required').max(200),
  path:              z.string().min(1, 'path required'),
  hash:              z.string().optional(),
  privacyClass:      z.enum(['public', 'internal', 'sensitive', 'local-only']).optional(),
  lastFetched:       z.string().optional(),
  freshnessTtlHours: z.number().int().min(0).optional(),
  isStale:           z.boolean().optional(),
  metadata:          z.record(z.string(), z.string()).optional(),
})

export type KnowledgeSourceInput = z.infer<typeof KnowledgeSourceSchema>

// ─── Research Document ───────────────────────────────────────────────────────

export const ResearchDocumentSchema = z.object({
  topic:                  z.string().min(3, 'topic required').max(500),
  question:               z.string().max(1000).optional(),
  relatedWorkItemId:      z.string().optional(),
  relatedProjectBriefId:  z.string().optional(),
  tags:                   z.array(z.string()).optional(),
})

export type ResearchDocumentInput = z.infer<typeof ResearchDocumentSchema>

// ─── Context Package (knowledge/context-package) ─────────────────────────────

export const KnowledgeContextPackageSchema = z.object({
  goal:          z.string().min(3, 'goal required'),
  workItemId:    z.string().optional(),
  delegationId:  z.string().optional(),
  maxCards:      z.number().int().min(1).max(20).optional(),
})

export type KnowledgeContextPackageInput = z.infer<typeof KnowledgeContextPackageSchema>

// ─── Context Package (context-packages) ─────────────────────────────────────

export const BuildContextPackageSchema = z.object({
  workItemId: z.string().min(1, 'workItemId required'),
  title:      z.string().min(1, 'title required').max(200),
  objective:  z.string().min(1, 'objective required'),
})

export type BuildContextPackageInput = z.infer<typeof BuildContextPackageSchema>

// ─── Orchestrated Run ────────────────────────────────────────────────────────

export const CreateOrchestratedRunSchema = z.object({
  delegationId:    z.string().min(1, 'delegationId required'),
  delegationTitle: z.string().min(1).max(200).optional(),
  goal:            z.string().min(1, 'goal required'),
  context:         z.string().optional(),
  useAI:           z.boolean().optional(),
})

export type CreateOrchestratedRunInput = z.infer<typeof CreateOrchestratedRunSchema>

// ─── Scope Lock ──────────────────────────────────────────────────────────────

export const ScopeLockClaimSchema = z.object({
  agentId:      z.string().min(1, 'agentId required'),
  agentType:    z.string().min(1, 'agentType required'),
  milestone:    z.string().min(1, 'milestone required'),
  branch:       z.string().min(1, 'branch required'),
  filePatterns: z.array(z.string()).min(1, 'filePatterns required'),
  ttlMinutes:   z.number().int().min(1).optional(),
  pid:          z.number().int().optional(),
  shareBranch:  z.boolean().optional(),
})

export type ScopeLockClaimInput = z.infer<typeof ScopeLockClaimSchema>

export const ScopeLockHeartbeatSchema = z.object({
  agentId:    z.string().min(1, 'agentId required'),
  ttlMinutes: z.number().int().min(1).optional(),
})

export type ScopeLockHeartbeatInput = z.infer<typeof ScopeLockHeartbeatSchema>

export const ScopeLockPreflightSchema = z.object({
  branch:       z.string().min(1, 'branch required'),
  filePatterns: z.array(z.string()).min(1, 'filePatterns required'),
  agentId:      z.string().optional(),
})

export type ScopeLockPreflightInput = z.infer<typeof ScopeLockPreflightSchema>

// ─── Agent Validate ──────────────────────────────────────────────────────────

export const AgentValidateSchema = z.object({
  agentId:     z.string().optional(),
  milestone:   z.string().optional(),
  testPattern: z.string().optional(),
})

export type AgentValidateInput = z.infer<typeof AgentValidateSchema>

// ─── Agent Optimize ──────────────────────────────────────────────────────────

export const AgentOptimizeSchema = z.object({
  task: z.object({
    id:                 z.string(),
    title:              z.string(),
    description:        z.string(),
    acceptanceCriteria: z.array(z.string()),
    skillCategory:      z.enum(['api-route', 'ui-component', 'data-model', 'test', 'refactor', 'infrastructure', 'documentation']),
    assignedAgentType:  z.enum(['claude-code', 'codex', 'antigravity', 'general']),
    filePatterns:       z.array(z.string()),
    effort:             z.enum(['S', 'M', 'L']),
    dependsOn:          z.array(z.string()),
    order:              z.number().int(),
  }),
  agentType:       z.string().min(1, 'agentType required'),
  testsPassed:     z.boolean(),
  typeErrorCount:  z.number().int().min(0),
  lintErrorCount:  z.number().int().min(0),
  filesChanged:    z.number().int().min(0),
  retryCount:      z.number().int().min(0).optional(),
  durationMinutes: z.number().min(0).optional(),
})

export type AgentOptimizeInput = z.infer<typeof AgentOptimizeSchema>

// ─── Agent Profile ───────────────────────────────────────────────────────────

export const AgentProfileSchema = z.object({
  id:          z.string().min(1, 'id required'),
  role:        z.string().min(1, 'role required'),
  displayName: z.string().min(1, 'displayName required'),
}).passthrough()

export type AgentProfileInput = z.infer<typeof AgentProfileSchema>

// ─── AI Chat Test ────────────────────────────────────────────────────────────

export const ChatTestSchema = z.object({
  providerId:   z.string().min(1, 'providerId required'),
  modelId:      z.string().min(1, 'modelId required'),
  prompt:       z.string().min(1, 'prompt required'),
  systemPrompt: z.string().optional(),
  maxTokens:    z.number().int().min(1).max(8192).optional(),
})

export type ChatTestInput = z.infer<typeof ChatTestSchema>

// ─── AI Workload ─────────────────────────────────────────────────────────────

export const AIWorkloadSchema = z.object({
  workload:      z.enum(['embed', 'classify', 'summarize', 'compress']),
  text:          z.string().min(1, 'text required'),
  labels:        z.array(z.string()).optional(),
  targetTokens:  z.number().int().min(1).optional(),
  maxSentences:  z.number().int().min(1).optional(),
  model:         z.string().optional(),
})

export type AIWorkloadInput = z.infer<typeof AIWorkloadSchema>

// ─── API Keys ────────────────────────────────────────────────────────────────

export const ApiKeysUpdateSchema = z.record(
  z.string(),
  z.string(),
)

export type ApiKeysUpdate = z.infer<typeof ApiKeysUpdateSchema>

// ─── Model Router ────────────────────────────────────────────────────────────

export const ModelRouterTaskSchema = z.object({
  taskId:      z.string().min(1, 'taskId required'),
  workload:    z.string().min(1, 'workload required'),
  privacyMode: z.string().min(1, 'privacyMode required'),
}).passthrough()

export type ModelRouterTaskInput = z.infer<typeof ModelRouterTaskSchema>

export const ModelProfileSchema = z.object({
  id:        z.string().min(1, 'id required'),
  provider:  z.string().min(1, 'provider required'),
  modelName: z.string().min(1, 'modelName required'),
}).passthrough()

export type ModelProfileInput = z.infer<typeof ModelProfileSchema>

// ─── PM Agent Auto (PATCH) ───────────────────────────────────────────────────

export const PMAgentAutoPatchSchema = z.object({
  autoPmAgent: z.boolean(),
})

export type PMAgentAutoPatch = z.infer<typeof PMAgentAutoPatchSchema>

// ─── Work Item Dependencies ───────────────────────────────────────────────────

export const WorkItemDependenciesSchema = z.object({
  blockedBy: z.array(z.string()),
})

export type WorkItemDependenciesInput = z.infer<typeof WorkItemDependenciesSchema>

// ─── Project Brief Patch ──────────────────────────────────────────────────────

export const ProjectBriefPatchSchema = z.object({
  title:            z.string().min(3).max(200).optional(),
  status:           z.enum(['draft', 'in_review', 'accepted', 'archived']).optional(),
  rawIdea:          z.string().optional(),
  problemStatement: z.string().optional(),
  targetAudience:   z.string().optional(),
  desiredOutcome:   z.string().optional(),
  constraints:      z.array(z.string()).optional(),
  nonGoals:         z.array(z.string()).optional(),
  scope:            z.enum(['minimal', 'standard', 'full']).optional(),
  researchMode:     z.enum(['quick', 'standard', 'deep']).optional(),
  privacyMode:      z.enum(['local', 'hybrid', 'cloud']).optional(),
}).passthrough()

export type ProjectBriefPatch = z.infer<typeof ProjectBriefPatchSchema>

// ─── Project Brief Requirements ───────────────────────────────────────────────

export const RequirementAddSchema = z.object({
  title:       z.string().min(3, 'title required').max(200),
  description: z.string().min(3, 'description required'),
  type:        z.enum(['functional', 'non-functional', 'constraint', 'assumption']).optional(),
  priority:    z.enum(['must', 'should', 'could', 'wont']).optional(),
})

export type RequirementAddInput = z.infer<typeof RequirementAddSchema>

// ─── Pilot Route ─────────────────────────────────────────────────────────────

export const PilotInputSchema = z.object({
  workItemId: z.string().min(1, 'workItemId required'),
  title:      z.string().min(1, 'title required').max(200),
  goal:       z.string().min(5, 'goal required'),
}).passthrough()

export type PilotInput = z.infer<typeof PilotInputSchema>

// ─── Idea to Production ──────────────────────────────────────────────────────

export const IdeaToProductionSchema = z.object({
  idea: z.string().min(5, 'idea required').max(2000),
})

export type IdeaToProductionInput = z.infer<typeof IdeaToProductionSchema>

// ─── PR Review ───────────────────────────────────────────────────────────────

export const PRReviewSchema = z.object({
  prNumber:      z.number().int().min(1, 'prNumber must be a positive integer'),
  delegationId:  z.string().optional(),
  expectedScope: z.array(z.string()).optional(),
})

export type PRReviewInput = z.infer<typeof PRReviewSchema>

// ─── From Research ───────────────────────────────────────────────────────────

export const FromResearchSchema = z.object({
  researchId: z.string().min(1, 'researchId required'),
})

export type FromResearchInput = z.infer<typeof FromResearchSchema>

// ─── Full Cycle ───────────────────────────────────────────────────────────────

export const FullCycleSchema = z.object({
  topic:    z.string().trim().min(1, 'topic required').max(500),
  question: z.string().max(1000).optional(),
})

export type FullCycleInput = z.infer<typeof FullCycleSchema>

// ─── Policy ───────────────────────────────────────────────────────────────────

export const PolicyEvalSchema = z.object({
  id:        z.string().min(1, 'id required'),
  goal:      z.string().min(1, 'goal required'),
  riskClass: RiskClassSchema,
}).passthrough()

export type PolicyEvalInput = z.infer<typeof PolicyEvalSchema>

// ─── Telegram Send ───────────────────────────────────────────────────────────

export const TelegramSendSchema = z.object({
  text: z.string().min(1, 'text required').max(4096),
})

export type TelegramSendInput = z.infer<typeof TelegramSendSchema>

// ─── Agent Run Patch ─────────────────────────────────────────────────────────

export const AgentRunPatchSchema = z.record(z.string(), z.unknown())

export type AgentRunPatch = z.infer<typeof AgentRunPatchSchema>

// ─── Orchestrated Run Patch ───────────────────────────────────────────────────

export const OrchestratedRunPatchSchema = z.object({
  taskId:    z.string().optional(),
  status:    z.string().optional(),
  result:    z.record(z.string(), z.unknown()).optional(),
  runStatus: z.string().optional(),
})

export type OrchestratedRunPatch = z.infer<typeof OrchestratedRunPatchSchema>

// ─── Settings Autonomous ─────────────────────────────────────────────────────

export const AutonomousConfigSchema = z.object({
  enabled:                 z.boolean().optional(),
  autoApproveDelegations:  z.boolean().optional(),
  autoExecuteOnApproval:   z.boolean().optional(),
  riskThreshold:           z.enum(['low', 'medium', 'high']).optional(),
})

export type AutonomousConfigInput = z.infer<typeof AutonomousConfigSchema>

// ─── Settings Env ────────────────────────────────────────────────────────────

export const EnvKeySchema = z.object({
  key:   z.string().min(1, 'key required'),
  value: z.string().min(1, 'value required'),
})

export type EnvKeyInput = z.infer<typeof EnvKeySchema>

// ─── Project Brief ────────────────────────────────────────────────────────────

export const ProjectBriefSchema = z.object({
  title:            z.string().min(3, 'Title required').max(200),
  rawIdea:          z.string().min(10, 'Idea required'),
  problemStatement: z.string().min(10, 'Problem statement required'),
  targetAudience:   z.string().min(3, 'Target audience required'),
  desiredOutcome:   z.string().min(5, 'Desired outcome required'),
  constraints:      z.array(z.string()).default([]),
  scope:            z.enum(['minimal', 'standard', 'full']).default('standard'),
  researchMode:     z.enum(['quick', 'standard', 'deep']).default('standard'),
  privacyMode:      z.enum(['local', 'hybrid', 'cloud']).default('local'),
})

export type ProjectBriefInput = z.infer<typeof ProjectBriefSchema>
