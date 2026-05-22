/**
 * StorageMode configuration for ForgePilot.
 *
 * Controls whether the application persists data via JSON files (Phase-0 / dev),
 * dual-write (migration), or PostgreSQL only (production).
 *
 * Configure via env var: STORAGE_MODE=json|dual|postgres
 * Legacy delegation-only override: FORGEPILOT_DELEGATION_STORAGE=json|dual|postgres
 */

export type StorageMode = 'json' | 'dual' | 'postgres'

function parseStorageMode(raw: string | undefined): StorageMode | null {
  const value = (raw ?? '').trim().toLowerCase()
  if (value === 'json' || value === 'dual' || value === 'postgres') return value
  return null
}

export function getStorageMode(): StorageMode {
  const explicitMode = parseStorageMode(process.env.STORAGE_MODE)
  if (explicitMode) return explicitMode

  const delegationMode = parseStorageMode(process.env.FORGEPILOT_DELEGATION_STORAGE)
  if (delegationMode) return delegationMode

  const postgresConfigured = Boolean(process.env.DATABASE_URL ?? process.env.SUPABASE_URL)
  return postgresConfigured ? 'postgres' : 'json'
}

export function getConfiguredStorageMode(): StorageMode | null {
  return parseStorageMode(process.env.STORAGE_MODE)
    ?? parseStorageMode(process.env.FORGEPILOT_DELEGATION_STORAGE)
}

export interface StorageStatus {
  mode: StorageMode
  configuredMode: StorageMode | null
  postgresConfigured: boolean
  jsonFallbackActive: boolean
  risks: string[]
  recommendation: string
}

export function getStorageStatus(): StorageStatus {
  const mode = getStorageMode()
  const configuredMode = getConfiguredStorageMode()
  const postgresConfigured = Boolean(
    process.env.DATABASE_URL ?? process.env.SUPABASE_URL,
  )
  const risks: string[] = []

  if (mode === 'json') {
    risks.push('Race conditions bei parallelen Schreibzugriffen möglich')
    risks.push('Keine ACID-Transaktionen — Datenverlust bei Crash möglich')
    risks.push('Nicht für Produktion mit mehreren Nutzern geeignet')
  }
  if (mode === 'dual' && !postgresConfigured) {
    risks.push(
      'Storage mode ist dual, aber keine DATABASE_URL/SUPABASE_URL ist konfiguriert — fällt auf json zurück',
    )
  }
  if (mode === 'postgres' && !postgresConfigured) {
    risks.push(
      'Storage mode ist postgres, aber keine DATABASE_URL/SUPABASE_URL ist konfiguriert — App wird fehlschlagen',
    )
  }

  const recommendation =
    mode === 'postgres' && postgresConfigured
      ? 'PostgreSQL aktiv — Production-ready'
      : mode === 'dual'
        ? 'Dual-Write aktiv — Migration läuft'
        : 'JSON-Modus: nur für Entwicklung und Bootstrap geeignet. Für Produktion STORAGE_MODE=postgres setzen.'

  return {
    mode,
    configuredMode,
    postgresConfigured,
    jsonFallbackActive: mode === 'json' || (mode === 'dual' && !postgresConfigured),
    risks,
    recommendation,
  }
}
