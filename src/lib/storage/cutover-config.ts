/**
 * StorageMode configuration for ForgePilot.
 *
 * Controls whether the application persists data via JSON files (Phase-0 / dev),
 * dual-write (migration), or PostgreSQL only (production).
 *
 * Configure via env var: STORAGE_MODE=json|dual|postgres
 */

export type StorageMode = 'json' | 'dual' | 'postgres'

export function getStorageMode(): StorageMode {
  const raw = (process.env.STORAGE_MODE ?? '').trim().toLowerCase()
  if (raw === 'dual' || raw === 'postgres') return raw
  return 'json'
}

export interface StorageStatus {
  mode: StorageMode
  postgresConfigured: boolean
  jsonFallbackActive: boolean
  risks: string[]
  recommendation: string
}

export function getStorageStatus(): StorageStatus {
  const mode = getStorageMode()
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
      'STORAGE_MODE=dual aber keine DATABASE_URL/SUPABASE_URL — fällt auf json zurück',
    )
  }
  if (mode === 'postgres' && !postgresConfigured) {
    risks.push(
      'STORAGE_MODE=postgres aber keine DATABASE_URL konfiguriert — App wird fehlschlagen',
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
    postgresConfigured,
    jsonFallbackActive: mode === 'json' || (mode === 'dual' && !postgresConfigured),
    risks,
    recommendation,
  }
}
