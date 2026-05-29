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

// ─── Expert Mode Policy Primitives (#19) ─────────────────────────────────────

export const ToolPolicySchema = z.enum([
  'all',           // agent may use all available tools
  'code-read',     // read-only file access only
  'code-write',    // file read + write, no shell/web
  'web-search',    // web search allowed in addition to code-read
  'restricted',    // minimal: no file writes, no shell, no web
  'custom',        // fine-grained via toolAllowList / toolDenyList
])
export type ToolPolicy = z.infer<typeof ToolPolicySchema>

export const OutputPolicySchema = z.enum([
  'pr',                // create GitHub PR only
  'writeback',         // write knowledge card only
  'pr-and-writeback',  // both PR and knowledge card
  'none',              // no automatic output — manual review
])
export type OutputPolicy = z.infer<typeof OutputPolicySchema>

export const ApprovalModeSchema = z.enum([
  'auto',     // approved automatically when confidence ≥ threshold
  'manual',   // always requires human sign-off
  'skip',     // no approval gate (risk class A only)
])
export type ApprovalMode = z.infer<typeof ApprovalModeSchema>

// ─── Delegation ───────────────────────────────────────────────────────────────

export const DelegationContractSchema = z.object({
  goal:             z.string().min(10, 'Goal must be at least 10 characters'),
  riskClass:        RiskClassSchema.default('A'),
  privacyMode:      PrivacyModeSchema.default('local'),
  requiresApproval: z.boolean().default(false),
  maxBudgetUsd:     z.number().min(0, 'Budget must be 0 or higher').max(1000, 'Budget must be at most $1000').optional(),
  filePatterns:     z.array(z.string()).optional(),
  skillCategory:    z.string().optional(),
  acceptanceCriteria: z.array(z.string()).optional(),
  context:          z.string().optional(),
  // ── Expert Mode Policy Fields (#19) — all optional, safe defaults apply when absent ──
  llmProvider:      z.string().optional(),
  llmModel:         z.string().optional(),
  executionRoute:   z.string().optional(),
  toolPolicy:       ToolPolicySchema.optional(),
  toolAllowList:    z.array(z.string()).optional(),
  toolDenyList:     z.array(z.string()).optional(),
  outputPolicy:     OutputPolicySchema.optional(),
  approvalMode:     ApprovalModeSchema.optional(),
  approvalThreshold: z.number().min(0).max(100).optional(),
  writeScope:       z.array(z.string()).optional(),
})

export type DelegationContract = z.infer<typeof DelegationContractSchema>

export const CreateDelegationSchema = z.object({
  title:            z.string().min(3, 'Title required').max(200, 'Title must be at most 200 characters'),
  contract:         DelegationContractSchema,
  dataSubjectId:    z.string().optional(),
  privacyClass:     z.string().optional(),
  autoOrchestrate:  z.boolean().optional(),
})

export type CreateDelegationInput = z.infer<typeof CreateDelegationSchema>

// ─── Intake Webhook Body ─────────────────────────────────────────────────────
// Validates the raw n8n / Linear webhook payload sent to /api/intake.
// Accepts both camelCase and snake_case field aliases — the route maps them
// after validation. Uses .passthrough() so extra fields are preserved.

export const IntakeWebhookBodySchema = z.object({
  // Primary fields (camelCase preferred, snake_case aliases also accepted)
  title:              z.string().min(1, 'title required').max(200).optional(),
  rawIdea:            z.string().max(5000).optional(),
  raw_idea:           z.string().max(5000).optional(),
  idea:               z.string().max(5000).optional(),
  problemStatement:   z.string().max(5000).optional(),
  problem_statement:  z.string().max(5000).optional(),
  problem:            z.string().max(5000).optional(),
  targetAudience:     z.string().max(500).optional(),
  target_audience:    z.string().max(500).optional(),
  audience:           z.string().max(500).optional(),
  desiredOutcome:     z.string().max(500).optional(),
  desired_outcome:    z.string().max(500).optional(),
  outcome:            z.string().max(500).optional(),
  scope:              z.enum(['minimal', 'standard', 'full']).optional(),
  researchMode:       z.enum(['quick', 'standard', 'deep']).optional(),
  research_mode:      z.enum(['quick', 'standard', 'deep']).optional(),
  privacyMode:        z.enum(['local', 'hybrid', 'cloud']).optional(),
  privacy_mode:       z.enum(['local', 'hybrid', 'cloud']).optional(),
  constraints:        z.union([z.array(z.string()), z.string()]).optional(),
  // Pipeline control flags
  autoDelegate:       z.boolean().optional(),
  auto_delegate:      z.boolean().optional(),
  autoApprove:        z.boolean().optional(),
  auto_approve:       z.boolean().optional(),
  autoExecute:        z.boolean().optional(),
  auto_execute:       z.boolean().optional(),
}).passthrough()
  .refine(
    d => {
      const hasIdea = Boolean(d.rawIdea ?? d.raw_idea ?? d.idea)
      return hasIdea
    },
    { message: 'At least one of rawIdea, raw_idea, or idea is required' },
  )

export type IntakeWebhookBody = z.infer<typeof IntakeWebhookBodySchema>

// ─── Idea Intake ──────────────────────────────────────────────────────────────

export const IdeaIntakeSchema = z.object({
  idea:             z.string().min(10, 'Idea must be at least 10 characters').max(2000, 'Idea must be at most 2000 characters'),
  context:          z.string().max(5000, 'Context must be at most 5000 characters').optional(),
  targetUsers:      z.string().max(500, 'Target users must be at most 500 characters').optional(),
  successMetric:    z.string().max(500, 'Success metric must be at most 500 characters').optional(),
  riskTolerance:    RiskClassSchema.optional(),
  autoRun:          z.boolean().optional(),
})

export type IdeaIntakeInput = z.infer<typeof IdeaIntakeSchema>

// ─── Work Item ────────────────────────────────────────────────────────────────

export const WorkItemSchema = z.object({
  id:               z.string().optional(),
  title:            z.string().min(3, 'Title must be at least 3 characters').max(500, 'Title must be at most 500 characters'),
  url:              z.string().url('Must be a valid URL, e.g. https://example.com').optional().or(z.literal('')),
  projectId:        z.string().optional(),
  status:           z.enum(['todo', 'in_progress', 'done', 'blocked']).default('todo'),
  priority:         z.number().int('Priority must be a whole number').min(0, 'Priority must be 0 or higher').max(10, 'Priority must be 10 or lower').default(1),
  riskClass:        RiskClassSchema.default('A'),
  aiDelegable:      z.boolean().default(false),
  estimatedMinutes: z.number().int('Estimated minutes must be a whole number').min(0, 'Estimated minutes must be 0 or higher').optional(),
  metadata:         z.record(z.string(), z.unknown()).optional(),
})

export type WorkItemInput = z.infer<typeof WorkItemSchema>

// ─── AI Provider ─────────────────────────────────────────────────────────────

export const ProviderConfigSchema = z.object({
  id:           z.string().min(1, 'ID required').max(50, 'ID must be at most 50 characters').regex(/^[a-z0-9-]+$/, 'ID must be lowercase alphanumeric with hyphens'),
  name:         z.string().min(1, 'Name required').max(100, 'Name must be at most 100 characters'),
  type:         ProviderTypeSchema,
  apiKey:       z.string().optional(),
  baseUrl:      z.string().url('Must be a valid URL, e.g. http://localhost:11434 or https://api.example.com').optional(),
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
  title:              z.string().min(3, 'Title must be at least 3 characters').max(200, 'Title must be at most 200 characters'),
  prompt:             z.string().min(10, 'Prompt must be at least 10 characters'),
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
  externalId: z.string().min(1, 'externalId required').max(255, 'externalId must be at most 255 characters'),
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
  llmProvider:           z.string().optional(),
  outputMode:            z.enum(['text', 'json', 'stream']).optional(),
  skillCategory:         z.enum(['api-route', 'ui-component', 'data-model', 'test', 'refactor', 'infrastructure', 'documentation']).optional(),
  allowedFilePatterns:   z.array(z.string()).optional(),
  orchestratedRunId:     z.string().optional(),
  createdAt:             z.string(),
  // Expert Mode Policy Fields (#19)
  toolPolicy:            ToolPolicySchema.optional(),
  toolAllowList:         z.array(z.string()).optional(),
  toolDenyList:          z.array(z.string()).optional(),
  outputPolicy:          OutputPolicySchema.optional(),
  approvalMode:          ApprovalModeSchema.optional(),
  approvalThreshold:     z.number().min(0).max(100).optional(),
  writeScope:            z.array(z.string()).optional(),
  executionRoute:        z.string().optional(),
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
  status:           z.enum(['pending', 'approved', 'running', 'completed', 'failed', 'cancelled', 'rejected']).optional(),
  agentRunId:       z.string().optional(),
  note:             z.object({ text: z.string().max(2000), updatedAt: z.string() }).optional().nullable(),
  tags:             z.array(z.string().max(32)).max(10).optional(),
  priority:         z.number().int().min(1).max(5).optional(),
  autoOrchestrate:  z.boolean().optional(),
})

export type PatchDelegationInput = z.infer<typeof PatchDelegationSchema>

// ─── Delegation Escalate ─────────────────────────────────────────────────────

export const EscalateSchema = z.object({
  problem:        z.string().min(1, 'problem required'),
  options:        z.array(z.string()).optional(),
  recommendation: z.string().optional(),
})

export type EscalateInput = z.infer<typeof EscalateSchema>

// ─── Execute Loop Evidence ───────────────────────────────────────────────────

export const ExecuteLoopEvidenceStepsSchema = z.object({
  brief:      z.boolean().default(false),
  delegation: z.boolean().default(false),
  execute:    z.boolean().default(false),
  tests:      z.boolean().default(false),
  pr:         z.boolean().default(false),
  critic:     z.boolean().default(false),
  writeback:  z.boolean().default(false),
})

export const ExecuteLoopEvidenceRunSchema = z.object({
  id:                  z.string().min(3, 'ID must be at least 3 characters').max(120, 'ID must be at most 120 characters').optional(),
  title:               z.string().min(3, 'Title must be at least 3 characters').max(200, 'Title must be at most 200 characters'),
  status:              z.enum(['success', 'partial', 'blocked']).default('partial'),
  source:              z.enum(['manual', 'harness-dry-run']).default('manual'),
  delegationId:        z.string().max(120).optional(),
  briefId:             z.string().max(120).optional(),
  prUrl:               z.string().url('Must be a valid PR URL, e.g. https://github.com/org/repo/pull/123').optional(),
  timeSavedMinutes:    z.number().int().min(0).max(24 * 60).optional(),
  manualInterventions: z.number().int().min(0).max(100).optional(),
  blocker:             z.string().max(500).optional(),
  notes:               z.string().max(1000).optional(),
  steps:               ExecuteLoopEvidenceStepsSchema,
}).strict()

export type ExecuteLoopEvidenceRunInput = z.infer<typeof ExecuteLoopEvidenceRunSchema>

export const ExecuteLoopHarnessSchema = z.object({
  record:      z.boolean().default(true),
  scenarioSet: z.enum(['v1-core']).default('v1-core'),
}).strict()

export type ExecuteLoopHarnessInput = z.infer<typeof ExecuteLoopHarnessSchema>

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
  title:            z.string().min(3, 'Title must be at least 3 characters').max(200, 'Title must be at most 200 characters').optional(),
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
  planningMode: z.enum(['beginner', 'expert']).optional().default('beginner'),
  targetPlatform: z.enum(['webapp', 'desktop', 'mobile', 'cross_platform', 'undecided']).optional().default('undecided'),
  customPlatformNote: z.string().max(500).optional(),
  persistenceStrategy: z.enum(['recommend', 'postgres', 'sqlite', 'json_file', 'supabase', 'none']).optional().default('recommend'),
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

// ─── Notifications ────────────────────────────────────────────────────────────

export const NotificationMarkReadSchema = z.object({
  id:  z.string().optional(),
  all: z.boolean().optional(),
}).refine(d => d.id !== undefined || d.all === true, {
  message: 'Either id or all:true must be provided',
})

export type NotificationMarkReadInput = z.infer<typeof NotificationMarkReadSchema>

// ─── Magic Create ─────────────────────────────────────────────────────────────

export const MagicCreateSchema = z.object({
  mode:            z.enum(['manual', 'delegation', 'magic']).optional(),
  title:           z.string().max(200).optional(),
  description:     z.string().optional(),
  projectId:       z.string().optional(),
  milestone:       z.string().optional(),
  riskClass:       RiskClassSchema.optional(),
  priority:        z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  estimate:        z.number().min(0).max(480).optional(),
  prompt:          z.string().optional(),
  existingTicketId: z.string().optional(),
})

export type MagicCreateInput = z.infer<typeof MagicCreateSchema>

// ─── Telegram Config ──────────────────────────────────────────────────────────

export const TelegramConfigSchema = z.object({
  botToken: z.string().min(1).optional(),
  chatId:   z.string().min(1).optional(),
  enabled:  z.boolean().optional(),
})

export type TelegramConfigInput = z.infer<typeof TelegramConfigSchema>
