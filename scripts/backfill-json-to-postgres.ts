#!/usr/bin/env npx tsx
/**
 * Backfill script: reads core JSON stores and upserts them into Postgres.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npx tsx scripts/backfill-json-to-postgres.ts
 *   DRY_RUN=true DATABASE_URL=postgresql://... npx tsx scripts/backfill-json-to-postgres.ts
 *
 * Requires:
 *   - DATABASE_URL env var pointing to a running Postgres instance
 *   - Tables already created via: npx drizzle-kit push
 */

import fs from 'fs'
import path from 'path'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { delegations, projectBriefs } from '../src/db/schema'
import type { Delegation } from '../src/lib/models/delegation'
import type { ProjectBrief } from '../src/lib/models/project-brief'

const DRY_RUN = process.env.DRY_RUN === 'true'
const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Aborting.')
  process.exit(1)
}

// After the guard above, DATABASE_URL is guaranteed to be a string
const DB_URL: string = DATABASE_URL

const DELEGATIONS_FILE = path.join(process.cwd(), 'config', 'delegations.json')
const PROJECT_BRIEFS_FILE = path.join(process.cwd(), 'config', 'project-briefs.json')

function readJsonDelegations(): Delegation[] {
  if (!fs.existsSync(DELEGATIONS_FILE)) {
    console.warn(`⚠️  No delegations file found at ${DELEGATIONS_FILE}`)
    return []
  }
  const raw = fs.readFileSync(DELEGATIONS_FILE, 'utf-8')
  const parsed = JSON.parse(raw) as unknown
  if (!Array.isArray(parsed)) {
    console.warn('⚠️  delegations.json does not contain an array.')
    return []
  }
  return parsed as Delegation[]
}

function readJsonProjectBriefs(): ProjectBrief[] {
  if (!fs.existsSync(PROJECT_BRIEFS_FILE)) {
    console.warn(`⚠️  No project briefs file found at ${PROJECT_BRIEFS_FILE}`)
    return []
  }
  const raw = fs.readFileSync(PROJECT_BRIEFS_FILE, 'utf-8')
  const parsed = JSON.parse(raw) as unknown
  if (!Array.isArray(parsed)) {
    console.warn('⚠️  project-briefs.json does not contain an array.')
    return []
  }
  return parsed as ProjectBrief[]
}

function projectBriefContent(brief: ProjectBrief): Record<string, unknown> {
  const { id: _id, title: _title, status: _status, createdAt: _createdAt, updatedAt: _updatedAt, ...content } = brief
  return content as Record<string, unknown>
}

async function main(): Promise<void> {
  const delegationItems = readJsonDelegations()
  const projectBriefItems = readJsonProjectBriefs()
  console.log(`📂  Found ${delegationItems.length} delegation(s) in ${DELEGATIONS_FILE}`)
  console.log(`📂  Found ${projectBriefItems.length} project brief(s) in ${PROJECT_BRIEFS_FILE}`)

  if (delegationItems.length === 0 && projectBriefItems.length === 0) {
    console.log('Nothing to backfill. Done.')
    return
  }

  if (DRY_RUN) {
    console.log('🔍  DRY_RUN=true — no writes will be performed.')
    for (const d of delegationItems) {
      console.log(`  • ${d.id}  [${d.status}]  ${d.title}`)
    }
    for (const brief of projectBriefItems) {
      console.log(`  • ${brief.id}  [${brief.status}]  ${brief.title}`)
    }
    return
  }

  const client = postgres(DB_URL, { max: 1, prepare: false })
  const db = drizzle(client, { logger: false })

  let upsertedDelegations = 0
  let upsertedProjectBriefs = 0
  let failed = 0

  for (const d of delegationItems) {
    try {
      await db
        .insert(delegations)
        .values({
          id: d.id,
          title: d.title,
          status: d.status,
          riskClass: (d.contract?.riskClass as 'A' | 'B' | 'C') ?? 'B',
          executionRoute: d.executionRoute,
          contract: d.contract as unknown as Record<string, unknown>,
          summaryReport:
            d.summaryReport != null
              ? (d.summaryReport as unknown as Record<string, unknown>)
              : null,
          logs:
            d.logs != null
              ? (d.logs as unknown as Array<Record<string, unknown>>)
              : [],
          costEstimateUsd: d.costEstimateUsd,
          actualCostUsd: d.actualCostUsd ?? null,
          traceId: d.traceId ?? null,
          agentRunId: d.agentRunId ?? null,
          errorMessage: d.errorMessage ?? null,
          failureFeedback: d.failureFeedback ?? null,
          note: d.note?.text ?? null,
          autoOrchestrate: d.autoOrchestrate ?? false,
          priority: d.priority ?? null,
          briefId: d.briefId ?? null,
          criticScore:
            d.criticScore != null
              ? (d.criticScore as unknown as Record<string, unknown>)
              : null,
          contextSnapshot:
            d.contextSnapshot != null
              ? (d.contextSnapshot as unknown as Record<string, unknown>)
              : null,
          startedAt: d.startedAt ? new Date(d.startedAt) : null,
          completedAt: d.completedAt ? new Date(d.completedAt) : null,
          createdAt: new Date(d.createdAt),
          updatedAt: new Date(d.updatedAt),
        })
        .onConflictDoUpdate({
          target: delegations.id,
          set: {
            title: d.title,
            status: d.status,
            riskClass: (d.contract?.riskClass as 'A' | 'B' | 'C') ?? 'B',
            executionRoute: d.executionRoute,
            contract: d.contract as unknown as Record<string, unknown>,
            summaryReport:
              d.summaryReport != null
                ? (d.summaryReport as unknown as Record<string, unknown>)
                : null,
            logs:
              d.logs != null
                ? (d.logs as unknown as Array<Record<string, unknown>>)
                : [],
            costEstimateUsd: d.costEstimateUsd,
            actualCostUsd: d.actualCostUsd ?? null,
            traceId: d.traceId ?? null,
            agentRunId: d.agentRunId ?? null,
            errorMessage: d.errorMessage ?? null,
            failureFeedback: d.failureFeedback ?? null,
            note: d.note?.text ?? null,
            autoOrchestrate: d.autoOrchestrate ?? false,
            priority: d.priority ?? null,
            briefId: d.briefId ?? null,
            criticScore:
              d.criticScore != null
                ? (d.criticScore as unknown as Record<string, unknown>)
                : null,
            contextSnapshot:
              d.contextSnapshot != null
                ? (d.contextSnapshot as unknown as Record<string, unknown>)
                : null,
            startedAt: d.startedAt ? new Date(d.startedAt) : null,
            completedAt: d.completedAt ? new Date(d.completedAt) : null,
            updatedAt: new Date(d.updatedAt),
          },
        })
      upsertedDelegations++
      console.log(`  ✅  ${d.id}  ${d.title}`)
    } catch (err) {
      failed++
      console.error(`  ❌  ${d.id}  ${d.title}`, err)
    }
  }

  for (const brief of projectBriefItems) {
    try {
      await db
        .insert(projectBriefs)
        .values({
          id: brief.id,
          title: brief.title,
          status: brief.status as 'draft' | 'in_review' | 'research' | 'accepted' | 'archived',
          content: projectBriefContent(brief),
          version: 1,
          createdAt: new Date(brief.createdAt),
          updatedAt: new Date(brief.updatedAt),
        })
        .onConflictDoUpdate({
          target: projectBriefs.id,
          set: {
            title: brief.title,
            status: brief.status as 'draft' | 'in_review' | 'research' | 'accepted' | 'archived',
            content: projectBriefContent(brief),
            updatedAt: new Date(brief.updatedAt),
          },
        })
      upsertedProjectBriefs++
      console.log(`  ✅  ${brief.id}  ${brief.title}`)
    } catch (err) {
      failed++
      console.error(`  ❌  ${brief.id}  ${brief.title}`, err)
    }
  }

  await client.end()

  console.log(`\n✅  Upserted delegations: ${upsertedDelegations}  |  Upserted project briefs: ${upsertedProjectBriefs}  |  Failed: ${failed}`)
  if (failed > 0) process.exit(1)
}

main().catch((err: unknown) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
