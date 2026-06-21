import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  real,
  timestamp,
  jsonb,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core'

export const delegationStatusEnum = pgEnum('delegation_status', [
  'pending',
  'approved',
  'running',
  'completed',
  'failed',
  'cancelled',
  'rejected',
])

export const riskClassEnum = pgEnum('risk_class', ['A', 'B', 'C'])

export const executionRouteEnum = pgEnum('execution_route', [
  'direct-chat',
  'local-agent',
  'runner',
  'ollama-agent',
  'n8n',
  'manual',
])

export const todoPriorityEnum = pgEnum('todo_priority', ['low', 'medium', 'high'])
export const todoStatusEnum = pgEnum('todo_status', ['open', 'in_progress', 'done'])

export const delegations = pgTable(
  'delegations',
  {
    id: uuid('id').primaryKey(),
    title: text('title').notNull(),
    status: delegationStatusEnum('status').notNull().default('pending'),
    riskClass: riskClassEnum('risk_class').notNull().default('B'),
    executionRoute: executionRouteEnum('execution_route').notNull().default('manual'),
    contract: jsonb('contract').$type<Record<string, unknown>>().notNull(),
    summaryReport: jsonb('summary_report').$type<Record<string, unknown>>(),
    logs: jsonb('logs').$type<Array<Record<string, unknown>>>().notNull().default([]),
    costEstimateUsd: real('cost_estimate_usd').notNull().default(0),
    actualCostUsd: real('actual_cost_usd'),
    traceId: text('trace_id'),
    agentRunId: text('agent_run_id'),
    prUrl: text('pr_url'),
    errorMessage: text('error_message'),
    failureFeedback: text('failure_feedback'),
    note: text('note'),
    autoOrchestrate: boolean('auto_orchestrate').notNull().default(false),
    priority: integer('priority'),
    briefId: text('brief_id'),
    criticScore: jsonb('critic_score').$type<Record<string, unknown>>(),
    qualityCheck: jsonb('quality_check').$type<Record<string, unknown>>(),
    contextSnapshot: jsonb('context_snapshot').$type<Record<string, unknown>>(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('delegations_status_idx').on(t.status),
    index('delegations_brief_id_idx').on(t.briefId),
    index('delegations_created_at_idx').on(t.createdAt),
  ]
)

export type DbDelegation = typeof delegations.$inferSelect
export type NewDbDelegation = typeof delegations.$inferInsert

// ─── Todos ───────────────────────────────────────────────────────────────────

export const todoItems = pgTable(
  'todo_items',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    priority: todoPriorityEnum('priority').notNull().default('medium'),
    status: todoStatusEnum('status').notNull().default('open'),
    isSample: boolean('is_sample').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('todo_items_status_idx').on(t.status),
    index('todo_items_created_at_idx').on(t.createdAt),
  ]
)

export type DbTodoItem = typeof todoItems.$inferSelect
export type NewDbTodoItem = typeof todoItems.$inferInsert

// ─── ProjectBriefs ────────────────────────────────────────────────────────────

export const projectBriefStatusEnum = pgEnum('project_brief_status', [
  'draft', 'in_review', 'research', 'accepted', 'archived',
])

export const projectBriefs = pgTable('project_briefs', {
  id: uuid('id').primaryKey(),
  title: text('title').notNull(),
  status: projectBriefStatusEnum('status').notNull().default('draft'),
  content: jsonb('content').$type<Record<string, unknown>>().notNull().default({}),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('project_briefs_status_idx').on(t.status),
  index('project_briefs_created_at_idx').on(t.createdAt),
])

export type DbProjectBrief = typeof projectBriefs.$inferSelect
export type NewDbProjectBrief = typeof projectBriefs.$inferInsert

// ─── KnowledgeCards ───────────────────────────────────────────────────────────

export const knowledgeCardTypeEnum = pgEnum('knowledge_card_type', [
  'learning', 'pattern', 'decision', 'risk', 'reference',
])

export const knowledgeCards = pgTable('knowledge_cards', {
  id: uuid('id').primaryKey(),
  type: knowledgeCardTypeEnum('type').notNull().default('learning'),
  title: text('title').notNull(),
  body: text('body').notNull(),
  source: text('source'),
  delegationId: text('delegation_id'),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  confidence: real('confidence').notNull().default(0.8),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('knowledge_cards_type_idx').on(t.type),
  index('knowledge_cards_delegation_idx').on(t.delegationId),
  index('knowledge_cards_created_at_idx').on(t.createdAt),
])

export type DbKnowledgeCard = typeof knowledgeCards.$inferSelect
export type NewDbKnowledgeCard = typeof knowledgeCards.$inferInsert

// ─── DSGVO Processing Ledger ─────────────────────────────────────────────────

export const legalBasisEnum = pgEnum('legal_basis', [
  'legitimate-interest',
  'contract',
  'legal-obligation',
  'consent',
])

export const dataResidencyEnum = pgEnum('data_residency', ['eu', 'us', 'local', 'unknown'])

export const processingLedger = pgTable('processing_ledger', {
  id: uuid('id').primaryKey(),
  purpose: text('purpose').notNull(),
  dataTypes: jsonb('data_types').$type<string[]>().notNull().default([]),
  processor: text('processor').notNull(),
  legalBasis: legalBasisEnum('legal_basis').notNull().default('legitimate-interest'),
  dataSubjectId: text('data_subject_id'),
  piiDetected: boolean('pii_detected').notNull().default(false),
  piiCategories: jsonb('pii_categories').$type<string[]>().notNull().default([]),
  piiRedacted: boolean('pii_redacted').notNull().default(false),
  piiCount: integer('pii_count').notNull().default(0),
  dataResidency: dataResidencyEnum('data_residency').notNull().default('unknown'),
  providerId: text('provider_id'),
  modelId: text('model_id'),
  inputTokens: integer('input_tokens'),
  retentionDays: integer('retention_days').notNull().default(1825),
  processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('processing_ledger_processed_at_idx').on(t.processedAt),
  index('processing_ledger_subject_idx').on(t.dataSubjectId),
  index('processing_ledger_processor_idx').on(t.processor),
])

export type DbProcessingLedger = typeof processingLedger.$inferSelect
export type NewDbProcessingLedger = typeof processingLedger.$inferInsert
