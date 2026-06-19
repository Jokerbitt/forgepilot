/**
 * Building Blocks — reusable SaaS scaffolds the agent copies instead of
 * writing from scratch. The goal: never reinvent the wheel.
 *
 * Token-efficient by design: the agent prompt contains only the lightweight
 * CATALOG (what each block is, when to use it, where its files live). The
 * agent then reads only the block files it actually needs via the Read tool.
 */

export type BlockCategory =
  | 'auth'
  | 'database'
  | 'ui-layout'
  | 'billing'
  | 'testing'
  | 'api-crud'
  | 'deployment'
  | 'ai-routing'
  | 'ai-guardrails'
  | 'settings'
  | 'security'
  | 'landing'
  | 'dashboard'
  | 'forms-toast'
  // ─── Connectors (opt-in integrations, only pulled where needed) ──────────────
  | 'connector-email'
  | 'connector-oauth'
  | 'connector-storage'
  | 'connector-supabase'
  | 'connector-notify'
  | 'connector-realtime'
  | 'connector-analytics'
  | 'connector-jobs'

export type BlockStack =
  | 'nextjs'          // Next.js App Router
  | 'react'           // generic React
  | 'node'            // backend / API
  | 'any'

export interface BuildingBlockFile {
  /** Destination path relative to the target app root, e.g. "src/lib/auth/session.ts" */
  dest: string
  /** Source template path relative to the building-blocks/ dir, e.g. "auth/session.ts" */
  src: string
  /** One-line note on what this file does */
  note?: string
}

export interface BuildingBlock {
  id: string
  name: string
  category: BlockCategory
  stack: BlockStack
  /** One-line summary shown in the catalog */
  summary: string
  /** Precise guidance: when SHOULD the agent reach for this block (and when not) */
  whenToUse: string
  /** Keywords for relevance matching against a task goal */
  keywords: string[]
  /** npm packages this block needs */
  dependencies: string[]
  /** Files the agent should copy + adapt */
  files: BuildingBlockFile[]
  /** Post-copy steps (env vars, migrations, wiring) in plain instructions */
  setupSteps: string[]
}
