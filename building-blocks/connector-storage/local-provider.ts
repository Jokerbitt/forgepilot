/**
 * Local-disk storage provider (default, zero-config). Stores under
 * STORAGE_LOCAL_DIR (default ./storage) and serves via STORAGE_PUBLIC_BASE.
 *
 * For production multi-instance, use the S3 provider instead.
 */
import fs from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import type { StorageProvider, StoredObject } from './provider'

export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local'
  private dir: string
  private publicBase: string

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.dir = env.STORAGE_LOCAL_DIR ?? path.join(process.cwd(), 'storage')
    this.publicBase = (env.STORAGE_PUBLIC_BASE ?? '/storage').replace(/\/$/, '')
  }

  private full(key: string): string {
    return path.join(this.dir, key)
  }

  async put(key: string, body: Buffer | Uint8Array, contentType: string): Promise<StoredObject> {
    const dest = this.full(key)
    await fs.mkdir(path.dirname(dest), { recursive: true })
    const buf = Buffer.from(body)
    await fs.writeFile(dest, buf)
    return { key, url: `${this.publicBase}/${key}`, size: buf.byteLength, contentType }
  }

  async get(key: string): Promise<Buffer | null> {
    const dest = this.full(key)
    if (!existsSync(dest)) return null
    return fs.readFile(dest)
  }

  async delete(key: string): Promise<void> {
    const dest = this.full(key)
    if (existsSync(dest)) await fs.unlink(dest)
  }

  async url(key: string): Promise<string> {
    return `${this.publicBase}/${key}`
  }
}
