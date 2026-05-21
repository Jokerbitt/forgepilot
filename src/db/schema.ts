/**
 * ForgePilot — Drizzle ORM Schema
 *
 * Design decisions:
 *   - All tables have `userId` for future Row-Level Security (RLS)
 *   - JSONB columns for AI outputs, contract data, and metadata
 *     (structured data that evolves faster than migrations)
 *   - UUIDs everywhere — no auto-increment integers
 *   - All timestamps are ISO-8601 strings in application layer,
 *     stored as timestamptz in Postgres
 *   - Enum types defined in Postgres for constraint enforcement
 *   - Relations declared for Drizzle query builder (join inference)
 */

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
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ─── Enums ────────────────────────────────────────────────────────────────────

export const delegationStatusEnum = pgEnum('delegation_status', [
  'pending',
  'approved',
  'running',
  'completed',
  'failed',
  'cancelled',
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

export const projectStatusEnum = pgEnum('project_status', [
  'intake',
  'planning',
  'ready',
  'in_progress',
  'attention',
  'completed',
])

export const workItemStatusEnum = pgEnum('work_item_status', [
  'backlog',
  'todo',
  'in-progress',
  'in-review',
  'done',
  'cancelled',
])

export const workItemSourceEnum = pgEnum('work_item_source', [
  'linear',
  'github',
  'local',
])

export const projectBriefStatusEnum = pgEnum('project_brief_status', [
  'draft', 'in_review', 'accepted', 'archived',
])

export const notificationTypeEnum = pgEnum('notification_type', [
  'pm-alert', 'research-complete', 'delegation-blocked', 'delegation_pending',
  'milestone-at-risk', 'orchestration-complete', 'orchestration-failed',
  'run_complete', 'run_failed', 'delegation_approved', 'brief_ready', 'system',
])

export const notificationSeverityEnum = pgEnum('notification_severity', [
  'info', 'warning', 'critical',
])

// ─── users ────────────────────────────────────────────────────────────────────

/**
 * Single-tenant: one row per deployment.
 * Multi-tenant (future): one row per user across tenants.
 *
 * tenantId is 'default' for single-tenant; will be a real UUID once
 * multi-tenancy is implemented (M175+).
 */
export const users = pgTable(
  'users',
  {
    id:        uuid('id').primaryKey().defaultRandom(),
    email:     text('email').notNull(),
    name:      text('name').notNull().default(''),
    tenantId:  text('tenant_id').notNull().default('default'),
    role:      text('role').notNull().default('owner'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('users_email_tenant_idx').on(t.email, t.tenantId),
  ],
)

// ─── projects ─────────────────────────────────────────────────────────────────

export const projects = pgTable(
  'projects',
  {
    id:          uuid('id').primaryKey().defaultRandom(),
    userId:      uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name:        text('name').notNull(),
    description: text('description').notNull().default(''),
    status:      projectStatusEnum('status').notNull().default('intake'),
    /** Flexible bag for brief data, requirements, links — avoids premature column explosion */
    metadata:    jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('projects_user_id_idx').on(t.userId),
    index('projects_status_idx').on(t.status),
  ],
)

// ─── delegations ──────────────────────────────────────────────────────────────

/**
 * Core table. The `contract` and `summaryReport` columns are JSONB
 * because TaskContract evolves frequently and querying its internals
 * is not yet needed.
 *
 * `logs` is an array of AgentLog objects — stored as JSONB for easy
 * append (append via jsonb_insert or full overwrite).
 */
export const delegations = pgTable(
  'delegations',
  {
    id:              uuid('id').primaryKey(),           // preserve existing IDs from JSON
    userId:          uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    projectId:       uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),

    title:           text('title').notNull(),
    status:          delegationStatusEnum('status').notNull().default('pending'),
    riskClass:       riskClassEnum('risk_class').notNull().default('B'),
    executionRoute:  executionRouteEnum('execution_route').notNull().default('manual'),

    /** Full TaskContract — evolves with schema changes */
    contract:        jsonb('contract').$type<Record<string, unknown>>().notNull(),

    /** Structured output from the agent run */
    summaryReport:   jsonb('summary_report').$type<Record<string, unknown>>(),

    /** Array of AgentLog entries appended during execution */
    logs:            jsonb('logs').$type<Array<Record<string, unknown>>>().notNull().default([]),

    /** Cost estimates and actuals in USD */
    costEstimateUsd: real('cost_estimate_usd').notNull().default(0),
    actualCostUsd:   real('actual_cost_usd'),

    /** Token counts for analytics */
    promptTokens:    integer('prompt_tokens'),
    completionTokens: integer('completion_tokens'),

    /** OpenTelemetry trace ID for correlation with spans */
    traceId:         text('trace_id'),

    /** Human-readable agent run ID */
    agentRunId:      text('agent_run_id'),

    /** External PR URL after successful execution */
    prUrl:           text('pr_url'),

    /** Why execution failed, if applicable */
    errorMessage:    text('error_message'),

    /** Structured feedback from failure analysis (M118 retry) */
    failureFeedback: text('failure_feedback'),

    /** User-supplied note on this delegation */
    note:            text('note'),

    /** True when this delegation auto-orchestrates into sub-tasks */
    autoOrchestrate: boolean('auto_orchestrate').notNull().default(false),

    /** Priority rank (lower = more urgent) */
    priority:        integer('priority'),

    /** Connected Project Brief ID */
    briefId:         text('brief_id'),

    createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('delegations_user_id_idx').on(t.userId),
    index('delegations_project_id_idx').on(t.projectId),
    index('delegations_status_idx').on(t.status),
    index('delegations_created_at_idx').on(t.createdAt),
  ],
)

// ─── work_items ───────────────────────────────────────────────────────────────

export const workItems = pgTable(
  'work_items',
  {
    id:               uuid('id').primaryKey(),
    userId:           uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    projectId:        uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    delegationId:     uuid('delegation_id').references(() => delegations.id, { onDelete: 'set null' }),

    source:           workItemSourceEnum('source').notNull().default('local'),
    title:            text('title').notNull(),
    status:           workItemStatusEnum('status').notNull().default('backlog'),
    /** 0=urgent, 1=high, 2=medium, 3=low, 4=none */
    priority:         integer('priority').notNull().default(2),
    blocked:          boolean('blocked').notNull().default(false),
    /** IDs of items this item is blocked by */
    blockedBy:        jsonb('blocked_by').$type<string[]>().notNull().default([]),
    riskClass:        riskClassEnum('risk_class').notNull().default('B'),

    /** External URL (Linear ticket, GitHub issue) */
    url:              text('url').notNull().default(''),
    externalId:       text('external_id'),

    /** Linear/GitHub metadata — keeps columns clean */
    metadata:         jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),

    createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('work_items_user_id_idx').on(t.userId),
    index('work_items_project_id_idx').on(t.projectId),
    index('work_items_status_idx').on(t.status),
  ],
)

// ─── api_keys ─────────────────────────────────────────────────────────────────

/**
 * Stores encrypted API key values.
 *
 * SECURITY: The `encryptedValue` column must NEVER be returned to the client.
 * Use select({ id, name, userId, lastRotatedAt }) in all read queries.
 * Encryption key: FORGEPILOT_ENCRYPTION_KEY env var (AES-256-GCM recommended).
 *
 * For single-tenant NAS use, this is optional — keys can live in .env.local.
 * This table is for a future secrets management layer.
 */
export const apiKeys = pgTable(
  'api_keys',
  {
    id:              uuid('id').primaryKey().defaultRandom(),
    userId:          uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    /** Human-readable name e.g. 'ANTHROPIC_API_KEY', 'GITHUB_TOKEN' */
    name:            text('name').notNull(),
    /** AES-256-GCM encrypted value — never expose in API responses */
    encryptedValue:  text('encrypted_value').notNull(),
    lastRotatedAt:   timestamp('last_rotated_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('api_keys_user_name_idx').on(t.userId, t.name),
    index('api_keys_user_id_idx').on(t.userId),
  ],
)

// ─── project_briefs ───────────────────────────────────────────────────────────

/**
 * Stores ProjectBrief domain objects.
 * Top-level columns for filtering; full data in `data` JSONB.
 */
export const projectBriefs = pgTable(
  'project_briefs',
  {
    id:           uuid('id').primaryKey(),
    userId:       uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    title:        text('title').notNull(),
    status:       projectBriefStatusEnum('status').notNull().default('draft'),
    scope:        text('scope').notNull().default('standard'),
    researchMode: text('research_mode').notNull().default('standard'),
    privacyMode:  text('privacy_mode').notNull().default('local'),
    /** Full ProjectBrief object as JSONB — the type evolves quickly */
    data:         jsonb('data').$type<Record<string, unknown>>().notNull(),
    createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('project_briefs_user_id_idx').on(t.userId),
    index('project_briefs_status_idx').on(t.status),
  ],
)

// ─── notifications ────────────────────────────────────────────────────────────

export const notifications = pgTable(
  'notifications',
  {
    id:        uuid('id').primaryKey().defaultRandom(),
    userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    type:      notificationTypeEnum('type').notNull(),
    severity:  notificationSeverityEnum('severity').notNull().default('info'),
    title:     text('title').notNull(),
    body:      text('body').notNull(),
    link:      text('link'),
    sourceId:  text('source_id'),
    read:      boolean('read').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('notifications_user_id_idx').on(t.userId),
    index('notifications_read_idx').on(t.read),
    index('notifications_created_at_idx').on(t.createdAt),
  ],
)

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  projects:       many(projects),
  delegations:    many(delegations),
  workItems:      many(workItems),
  apiKeys:        many(apiKeys),
  projectBriefs:  many(projectBriefs),
  notifications:  many(notifications),
}))

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user:        one(users,      { fields: [projects.userId],    references: [users.id] }),
  delegations: many(delegations),
  workItems:   many(workItems),
}))

export const delegationsRelations = relations(delegations, ({ one, many }) => ({
  user:      one(users,    { fields: [delegations.userId],    references: [users.id] }),
  project:   one(projects, { fields: [delegations.projectId], references: [projects.id] }),
  workItems: many(workItems),
}))

export const workItemsRelations = relations(workItems, ({ one }) => ({
  user:       one(users,       { fields: [workItems.userId],       references: [users.id] }),
  project:    one(projects,    { fields: [workItems.projectId],    references: [projects.id] }),
  delegation: one(delegations, { fields: [workItems.delegationId], references: [delegations.id] }),
}))

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, { fields: [apiKeys.userId], references: [users.id] }),
}))

export const projectBriefsRelations = relations(projectBriefs, ({ one }) => ({
  user: one(users, { fields: [projectBriefs.userId], references: [users.id] }),
}))

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}))

// ─── Inferred types (use these in application code) ──────────────────────────

export type User          = typeof users.$inferSelect
export type NewUser       = typeof users.$inferInsert
export type Project       = typeof projects.$inferSelect
export type NewProject    = typeof projects.$inferInsert
export type Delegation    = typeof delegations.$inferSelect
export type NewDelegation = typeof delegations.$inferInsert
export type WorkItem      = typeof workItems.$inferSelect
export type NewWorkItem   = typeof workItems.$inferInsert
export type ApiKey        = typeof apiKeys.$inferSelect
export type NewApiKey     = typeof apiKeys.$inferInsert

// DB types for new tables — prefixed Db* to avoid collision with domain models
// in src/lib/models/ which use the same names without prefix.
export type DbProjectBrief    = typeof projectBriefs.$inferSelect
export type NewProjectBrief   = typeof projectBriefs.$inferInsert
export type DbNotification    = typeof notifications.$inferSelect
export type NewNotification   = typeof notifications.$inferInsert
