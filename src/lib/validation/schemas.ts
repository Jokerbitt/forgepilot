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
