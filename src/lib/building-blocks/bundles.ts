/**
 * bundles.ts — curated starter sets of building blocks per app type.
 *
 * Instead of picking blocks one by one, an app type maps to a vetted bundle
 * (the right combination that works together). The agent / UI can select a
 * bundle to scaffold a coherent foundation in one shot.
 */

import { BUILDING_BLOCKS } from './registry'
import type { BuildingBlock, BlockCategory } from './types'

export interface Bundle {
  id: string
  name: string
  description: string
  /** Keywords that route a goal to this bundle */
  keywords: string[]
  /** Block ids included, in recommended build order */
  blockIds: string[]
}

export const BUNDLES: Bundle[] = [
  {
    id: 'saas-starter',
    name: 'SaaS Starter',
    description: 'Full multi-user SaaS foundation: auth, database, billing, settings, security, app shell, deployment + tests.',
    keywords: ['saas', 'subscription', 'multi-user', 'paid', 'product', 'platform', 'b2b', 'startup'],
    blockIds: ['testing-vitest', 'security', 'ui-app-shell', 'db-prisma-postgres', 'auth-credentials', 'settings', 'api-crud-resource', 'billing-stripe', 'landing', 'deploy-vercel-docker'],
  },
  {
    id: 'ai-saas',
    name: 'AI SaaS',
    description: 'Production AI SaaS: local/cloud AI routing + guardrails (cost/rate/PII), auth, database, usage billing, settings, app shell, landing + tests. Everything a professional AI web app needs.',
    keywords: ['ai saas', 'ai-powered saas', 'ai platform', 'ai product', 'ai studio', 'content generation', 'ai writing', 'ai content', 'generation history', 'usage billing', 'credits', 'ai web app'],
    blockIds: ['testing-vitest', 'security', 'ui-app-shell', 'db-prisma-postgres', 'auth-credentials', 'ai-routing', 'ai-guardrails', 'settings', 'api-crud-resource', 'forms-toast', 'billing-stripe', 'landing', 'deploy-vercel-docker'],
  },
  {
    id: 'ai-app',
    name: 'AI App',
    description: 'Lightweight AI-powered app: local/cloud auto-routing, guardrails (cost/rate/PII), settings, app shell + tests. No auth/db/billing — use ai-saas for a full product.',
    keywords: ['ai', 'llm', 'chatbot', 'gpt', 'assistant', 'copilot', 'agent', 'rag', 'ml'],
    blockIds: ['testing-vitest', 'security', 'ui-app-shell', 'ai-routing', 'ai-guardrails', 'settings', 'forms-toast', 'api-crud-resource'],
  },
  {
    id: 'internal-tool',
    name: 'Internal Tool / Dashboard',
    description: 'Admin/dashboard tool: app shell, database, CRUD API, dashboard widgets, forms + tests.',
    keywords: ['dashboard', 'admin', 'internal', 'tool', 'crud', 'analytics', 'panel', 'back office'],
    blockIds: ['testing-vitest', 'ui-app-shell', 'db-prisma-postgres', 'api-crud-resource', 'dashboard', 'forms-toast'],
  },
  {
    id: 'local-first',
    name: 'Local-First App',
    description: 'Lightweight client-side app: app shell, forms/toasts + tests. No backend, localStorage persistence.',
    keywords: ['local', 'offline', 'localstorage', 'client', 'simple', 'todo', 'tracker', 'notes', 'lightweight'],
    blockIds: ['testing-vitest', 'ui-app-shell', 'forms-toast'],
  },
  {
    id: 'marketing-site',
    name: 'Marketing Site',
    description: 'Public marketing site: landing sections (hero/features/pricing), app shell + tests.',
    keywords: ['marketing', 'landing', 'website', 'public', 'homepage', 'product page'],
    blockIds: ['testing-vitest', 'ui-app-shell', 'landing'],
  },
]

export function getBundle(id: string): Bundle | undefined {
  return BUNDLES.find(b => b.id === id)
}

/** Resolve a bundle's block ids into the actual BuildingBlock objects. */
export function bundleBlocks(bundle: Bundle): BuildingBlock[] {
  return bundle.blockIds
    .map(id => BUILDING_BLOCKS.find(b => b.id === id))
    .filter((b): b is BuildingBlock => b !== undefined)
}

/**
 * Pick the best-matching bundle for a goal, or null when nothing scores.
 * Scoring is keyword overlap; ties broken by bundle order (most general last).
 */
/** Whole-word keyword match — avoids "ai" matching "email", "platform" matching nothing odd, etc. */
export function keywordHit(haystackLower: string, keyword: string): boolean {
  const kw = keyword.toLowerCase()
  // Multi-word keywords ("back office") use plain includes; single tokens use word boundaries.
  if (kw.includes(' ')) return haystackLower.includes(kw)
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${escaped}\\b`).test(haystackLower)
}

export function matchBundle(goal: string, context = ''): Bundle | null {
  const hay = `${goal} ${context}`.toLowerCase()
  let best: { bundle: Bundle; score: number } | null = null
  for (const bundle of BUNDLES) {
    let score = 0
    for (const kw of bundle.keywords) {
      if (keywordHit(hay, kw)) score += 2
    }
    if (score > 0 && (!best || score > best.score)) best = { bundle, score }
  }
  return best?.bundle ?? null
}
