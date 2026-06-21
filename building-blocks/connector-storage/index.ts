/**
 * Storage connector entrypoint — resolves a provider from env.
 *
 * STORAGE_PROVIDER = s3 | local (default: s3 when S3_BUCKET is set, else local)
 *
 * Usage:
 *   import { storage, safeKey } from '@/lib/storage'
 *   const obj = await storage().put(safeKey('avatars', file.name), bytes, file.type)
 */
import { LocalStorageProvider } from './local-provider'
import type { StorageProvider } from './provider'

let cached: StorageProvider | null = null

export function storage(env: NodeJS.ProcessEnv = process.env): StorageProvider {
  if (cached) return cached
  const choice = (env.STORAGE_PROVIDER ?? (env.S3_BUCKET ? 's3' : 'local')).toLowerCase()
  if (choice === 's3') {
    const { S3StorageProvider } = require('./s3-provider') as typeof import('./s3-provider')
    cached = new S3StorageProvider(env)
  } else {
    cached = new LocalStorageProvider(env)
  }
  return cached
}

/** Reset cached provider — useful in tests after changing env. */
export function __resetStorage(): void {
  cached = null
}

export { safeKey } from './provider'
export type { StorageProvider, StoredObject } from './provider'
