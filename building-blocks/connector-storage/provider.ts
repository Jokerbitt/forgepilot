/**
 * Storage connector — provider-agnostic object storage (uploads, attachments).
 * Swap S3/R2 ↔ local disk via STORAGE_PROVIDER without touching call sites.
 */

export interface StoredObject {
  key: string
  url: string
  size: number
  contentType: string
}

export interface StorageProvider {
  readonly name: string
  /** Store bytes under `key`; returns a retrievable URL. */
  put(key: string, body: Buffer | Uint8Array, contentType: string): Promise<StoredObject>
  /** Fetch bytes for `key`, or null if missing. */
  get(key: string): Promise<Buffer | null>
  delete(key: string): Promise<void>
  /** A URL the client can use to fetch the object (may be time-limited). */
  url(key: string, expiresInSeconds?: number): Promise<string>
}

/** Sanitize a user-supplied filename into a safe storage key segment. */
export function safeKey(prefix: string, filename: string): string {
  const clean = filename.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120)
  return `${prefix.replace(/\/$/, '')}/${clean || 'file'}`
}
