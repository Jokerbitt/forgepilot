/**
 * store-inventory.ts — JOK-188: Catalog of all ForgePilot data stores.
 *
 * Documents each store's current persistence mode, production risk, and
 * Postgres-readiness status. Used by StorageCutoverPanel and the storage-status API.
 */

import { getStorageMode, type StorageMode } from './cutover-config'
import { isDatabaseConfigured } from '@/db/index'

export type StoreMode = 'json' | 'postgres' | 'dual' | 'json-intentional'

export type StoreRisk = 'high' | 'medium' | 'low' | 'none'

export interface StoreEntry {
  /** Unique store key */
  key: string
  /** Human-readable label */
  label: string
  /** Config file path (relative to project root) */
  filePath: string
  /** Current persistence mode */
  mode: StoreMode
  /** Risk level if this store remains JSON in production */
  productionRisk: StoreRisk
  /** Whether a Postgres schema/repository exists for this store */
  postgresReady: boolean
  /** Short note about migration path or reason for current mode */
  note: string
}

// ─── Store catalog ────────────────────────────────────────────────────────────

const CATALOG: Omit<StoreEntry, 'mode'>[] = [
  {
    key: 'delegations',
    label: 'Delegations',
    filePath: 'config/delegations.json',
    productionRisk: 'none',  // has dual-write + postgres path
    postgresReady: true,
    note: 'Dual-Write verfügbar. FORGEPILOT_DELEGATION_STORAGE=postgres für vollständigen Cutover.',
  },
  {
    key: 'project-briefs',
    label: 'Project Briefs',
    filePath: 'config/project-briefs.json',
    productionRisk: 'none',
    postgresReady: true,
    note: 'Postgres-Repository aktiv wenn DATABASE_URL gesetzt. JSON als Fallback.',
  },
  {
    key: 'knowledge-cards',
    label: 'Knowledge Cards',
    filePath: 'config/knowledge-cards.json',
    productionRisk: 'none',
    postgresReady: true,
    note: 'Postgres-Repository aktiv wenn DATABASE_URL gesetzt. JSON als Fallback.',
  },
  {
    key: 'notifications',
    label: 'Notifications',
    filePath: 'config/notifications.json',
    productionRisk: 'medium',
    postgresReady: false,
    note: 'JSON-only. Bei Crash gehen ungelesene Notifications verloren.',
  },
  {
    key: 'attention-store',
    label: 'Attention Items',
    filePath: 'config/attention-store.json',
    productionRisk: 'medium',
    postgresReady: false,
    note: 'JSON-only. Inbox-Items können bei parallelen Writes verloren gehen.',
  },
  {
    key: 'orchestrated-runs',
    label: 'Orchestrated Runs',
    filePath: 'config/orchestrated-runs.json',
    productionRisk: 'high',
    postgresReady: false,
    note: 'JSON-only. Laufende Orchestrierungen verlieren bei Crash ihren State.',
  },
  {
    key: 'processing-ledger',
    label: 'DSGVO Processing Ledger',
    filePath: 'config/processing-ledger.json',
    productionRisk: 'none',
    postgresReady: true,
    note: 'Postgres-Repository aktiv wenn DATABASE_URL gesetzt. JSON bleibt Fallback/Importquelle.',
  },
  {
    key: 'audit-log',
    label: 'Audit Log',
    filePath: 'config/audit-log.json',
    productionRisk: 'medium',
    postgresReady: false,
    note: 'JSON-only. Audit-Trail für Governance. Verlust bei Crash möglich.',
  },
  {
    key: 'idea-history',
    label: 'Idea History',
    filePath: 'config/idea-history.json',
    productionRisk: 'low',
    postgresReady: false,
    note: 'JSON-only. Ideen-Pipeline. Verlust akzeptabel da rekonstruierbar.',
  },
  {
    key: 'knowledge-store',
    label: 'Knowledge Store (Memory Cards)',
    filePath: 'config/knowledge-store.json',
    productionRisk: 'none',
    postgresReady: true,
    note: 'Wird über KnowledgeCards-Repository nach Postgres abgebildet; Legacy-Datei bleibt Fallback/Importquelle.',
  },
  {
    key: 'api-keys',
    label: 'API Keys',
    filePath: 'config/api-keys.json',
    productionRisk: 'none',
    postgresReady: false,
    note: 'Bewusst JSON. Secrets in Datei — kein Postgres-Pfad vorgesehen.',
  },
  {
    key: 'running-processes',
    label: 'Running Processes',
    filePath: 'config/running-processes.json',
    productionRisk: 'none',
    postgresReady: false,
    note: 'Laufzeit-State. Inhalt verliert Gültigkeit nach Neustart.',
  },
  {
    key: 'skill-history',
    label: 'Skill History',
    filePath: 'config/skill-history.json',
    productionRisk: 'low',
    postgresReady: false,
    note: 'JSON-only. Agent-Skill-Verlauf. Verlust tolerierbar.',
  },
]

// ─── Runtime mode resolution ─────────────────────────────────────────────────

function resolveStoreMode(
  key: string,
  postgresReady: boolean,
  globalMode: StorageMode,
  dbConfigured: boolean,
): StoreMode {
  if (!postgresReady) return 'json'

  // Delegation has its own env var
  if (key === 'delegations') {
    const raw = (process.env.FORGEPILOT_DELEGATION_STORAGE ?? '').toLowerCase()
    if (raw === 'dual') return 'dual'
    if (raw === 'postgres' && dbConfigured) return 'postgres'
    if (raw === 'json') return 'json'
    // Fall through to global mode
  }

  if (globalMode === 'postgres' && dbConfigured) return 'postgres'
  if (globalMode === 'dual' && dbConfigured) return 'dual'
  if (dbConfigured) return 'postgres'  // project-briefs auto-activates postgres
  return 'json'
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface StoreInventory {
  stores: StoreEntry[]
  summary: {
    total: number
    postgresActive: number
    jsonOnly: number
    dualWrite: number
    highRiskJsonStores: number
    cutoverReadinessScore: number  // 0–100
  }
}

export function getStoreInventory(): StoreInventory {
  const globalMode = getStorageMode()
  const dbConfigured = isDatabaseConfigured()

  const stores: StoreEntry[] = CATALOG.map(entry => ({
    ...entry,
    mode: entry.key === 'api-keys' || entry.key === 'running-processes'
      ? 'json-intentional'
      : resolveStoreMode(entry.key, entry.postgresReady, globalMode, dbConfigured),
  }))

  const postgresActive = stores.filter(s => s.mode === 'postgres').length
  const dualWrite      = stores.filter(s => s.mode === 'dual').length
  const jsonOnly       = stores.filter(s => s.mode === 'json').length
  const highRiskJson   = stores.filter(s => s.mode === 'json' && s.productionRisk === 'high').length
  const criticalStores = stores.filter(s => s.productionRisk !== 'none')

  const score = criticalStores.length === 0
    ? 100
    : Math.round(
        (criticalStores.filter(s => s.mode !== 'json').length / criticalStores.length) * 100,
      )

  return {
    stores,
    summary: {
      total:                  stores.length,
      postgresActive:         postgresActive + dualWrite,
      jsonOnly,
      dualWrite,
      highRiskJsonStores:     highRiskJson,
      cutoverReadinessScore:  score,
    },
  }
}
