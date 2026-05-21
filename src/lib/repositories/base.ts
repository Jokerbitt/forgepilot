/**
 * Base Repository — Postgres-only storage backend
 *
 * M172: JSON stores removed. PostgreSQL is the single source of truth.
 * No dual-write, no JSON fallback, no feature flag.
 *
 * The legacy mode helpers (getPostgresMode, shouldWriteToPostgres, etc.)
 * are kept as no-op exports for import compatibility during the transition.
 * They are not used by any repository logic.
 */

// ─── Legacy no-op exports (import compatibility only) ─────────────────────────

/** @deprecated Postgres is always active in M172+. Kept for import compat. */
export type PostgresMode = 'off' | 'dual' | 'read' | 'postgres'

/** @deprecated Always returns 'postgres'. Kept for import compat. */
export function getPostgresMode(_env?: NodeJS.ProcessEnv): PostgresMode {
  return 'postgres'
}

/** @deprecated Always returns true. Kept for import compat. */
export function shouldWriteToPostgres(_mode?: PostgresMode): boolean {
  return true
}

/** @deprecated Always returns true. Kept for import compat. */
export function shouldReadFromPostgres(_mode?: PostgresMode): boolean {
  return true
}

/** @deprecated Always returns false. Kept for import compat. */
export function shouldWriteToJson(_mode?: PostgresMode): boolean {
  return false
}

// ─── Abstract base ────────────────────────────────────────────────────────────

/**
 * Abstract base class for Postgres-only repositories.
 *
 * Subclasses implement the four abstract Postgres methods.
 * The base class delegates all CRUD directly to Postgres.
 *
 * Type parameter T: the domain entity type (e.g., Delegation from models)
 * Type parameter CreateInput: the input type for create operations
 * Type parameter UpdateInput: the input type for update operations
 */
export abstract class BaseRepository<T, CreateInput, UpdateInput> {
  // ─── Subclass implements these ──────────────────────────────────────────────

  protected abstract createInPostgres(input: CreateInput): Promise<T>
  protected abstract findByIdFromPostgres(id: string): Promise<T | null>
  protected abstract updateInPostgres(id: string, input: UpdateInput): Promise<T | null>
  protected abstract deleteFromPostgres(id: string): Promise<boolean>

  // ─── Public API — direct Postgres passthrough ───────────────────────────────

  async create(input: CreateInput): Promise<T> {
    return this.createInPostgres(input)
  }

  async findById(id: string): Promise<T | null> {
    return this.findByIdFromPostgres(id)
  }

  async update(id: string, input: UpdateInput): Promise<T | null> {
    return this.updateInPostgres(id, input)
  }

  async delete(id: string): Promise<boolean> {
    return this.deleteFromPostgres(id)
  }
}
