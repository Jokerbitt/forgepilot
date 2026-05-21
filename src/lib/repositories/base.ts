/**
 * Base Repository — Feature-Flag controlled storage backend
 *
 * Migration Phases:
 *
 *   POSTGRES_MODE=off    → JSON stores only (default, no Postgres needed)
 *   POSTGRES_MODE=dual   → Write to both JSON + Postgres; read from JSON
 *                          Use this during migration to validate Postgres writes
 *   POSTGRES_MODE=read   → Write to both; read from Postgres
 *                          Use this to validate Postgres reads match JSON
 *   POSTGRES_MODE=postgres → Postgres only; JSON stores no longer written
 *                            Final state after successful validation
 *
 * Transition path:
 *   off → dual → read → postgres
 *
 * Never skip a phase. Each phase lets you validate the next step before
 * committing to it. Roll back by lowering the mode.
 */

export type PostgresMode = 'off' | 'dual' | 'read' | 'postgres'

/**
 * Read the current POSTGRES_MODE from environment.
 * Defaults to 'off' — safe for existing deployments.
 */
export function getPostgresMode(env: NodeJS.ProcessEnv = process.env): PostgresMode {
  const raw = (env.POSTGRES_MODE ?? 'off').trim().toLowerCase()
  if (raw === 'dual' || raw === 'read' || raw === 'postgres') return raw
  return 'off'
}

/**
 * True when Postgres writes should happen.
 * (dual, read, or postgres mode)
 */
export function shouldWriteToPostgres(mode: PostgresMode = getPostgresMode()): boolean {
  return mode !== 'off'
}

/**
 * True when Postgres should be used as the read source.
 * (read or postgres mode)
 */
export function shouldReadFromPostgres(mode: PostgresMode = getPostgresMode()): boolean {
  return mode === 'read' || mode === 'postgres'
}

/**
 * True when JSON store writes should still happen.
 * (off, dual, or read mode — NOT postgres-only)
 */
export function shouldWriteToJson(mode: PostgresMode = getPostgresMode()): boolean {
  return mode !== 'postgres'
}

// ─── Abstract base ────────────────────────────────────────────────────────────

/**
 * Abstract base class for repositories.
 *
 * Subclasses implement the four abstract methods for each backend.
 * The base class orchestrates dual-write and read routing based on mode.
 *
 * Type parameter T: the domain entity type (e.g., Delegation from models)
 * Type parameter CreateInput: the input type for create operations
 * Type parameter UpdateInput: the input type for update operations (Partial<T>)
 */
export abstract class BaseRepository<T, CreateInput, UpdateInput> {
  protected readonly mode: PostgresMode

  constructor(mode: PostgresMode = getPostgresMode()) {
    this.mode = mode
  }

  // ─── Subclass implements these ──────────────────────────────────────────────

  protected abstract createInJson(input: CreateInput): Promise<T>
  protected abstract createInPostgres(input: CreateInput): Promise<T>

  protected abstract findByIdFromJson(id: string): Promise<T | null>
  protected abstract findByIdFromPostgres(id: string): Promise<T | null>

  protected abstract updateInJson(id: string, input: UpdateInput): Promise<T | null>
  protected abstract updateInPostgres(id: string, input: UpdateInput): Promise<T | null>

  protected abstract deleteFromJson(id: string): Promise<boolean>
  protected abstract deleteFromPostgres(id: string): Promise<boolean>

  // ─── Orchestration (do not override) ───────────────────────────────────────

  /**
   * Create entity with dual-write orchestration.
   *
   * In dual/read mode: write to JSON first (source of truth), then
   * attempt Postgres write. Postgres failure is logged but not thrown —
   * JSON is the canonical store until POSTGRES_MODE=postgres.
   *
   * In postgres mode: write to Postgres only and throw on failure.
   */
  async create(input: CreateInput): Promise<T> {
    if (this.mode === 'off') {
      return this.createInJson(input)
    }

    if (this.mode === 'postgres') {
      return this.createInPostgres(input)
    }

    // dual or read: JSON is source of truth, Postgres is shadow write
    const entity = await this.createInJson(input)
    await this.shadowWriteToPostgres(() => this.createInPostgres(input))
    return entity
  }

  /**
   * Find by ID, routing based on mode.
   */
  async findById(id: string): Promise<T | null> {
    if (shouldReadFromPostgres(this.mode)) {
      return this.findByIdFromPostgres(id)
    }
    return this.findByIdFromJson(id)
  }

  /**
   * Update entity with dual-write orchestration.
   * Same shadow-write semantics as create().
   */
  async update(id: string, input: UpdateInput): Promise<T | null> {
    if (this.mode === 'off') {
      return this.updateInJson(id, input)
    }

    if (this.mode === 'postgres') {
      return this.updateInPostgres(id, input)
    }

    // dual or read: JSON is source of truth
    const entity = await this.updateInJson(id, input)
    await this.shadowWriteToPostgres(() => this.updateInPostgres(id, input))
    return entity
  }

  /**
   * Delete entity. Returns true if the entity existed and was deleted.
   */
  async delete(id: string): Promise<boolean> {
    if (this.mode === 'off') {
      return this.deleteFromJson(id)
    }

    if (this.mode === 'postgres') {
      return this.deleteFromPostgres(id)
    }

    const deleted = await this.deleteFromJson(id)
    await this.shadowWriteToPostgres(() => this.deleteFromPostgres(id))
    return deleted
  }

  // ─── Internal helpers ───────────────────────────────────────────────────────

  /**
   * Attempt a Postgres write without blocking the response or throwing.
   * Logs failures at warn level — operators can monitor for backlog.
   */
  private async shadowWriteToPostgres(fn: () => Promise<unknown>): Promise<void> {
    try {
      await fn()
    } catch (err) {
      // Import logger lazily to avoid circular dependency
      const { logger } = await import('@/lib/logger')
      logger.warn(
        {
          event: 'postgres.shadow_write.failed',
          mode: this.mode,
          error: err instanceof Error ? err.message : String(err),
        },
        'Postgres shadow write failed — JSON store is still source of truth',
      )
    }
  }
}
